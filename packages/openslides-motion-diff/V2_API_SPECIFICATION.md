# Motion-Diff v2.0 API Specification

## Executive Summary

This document outlines the proposed v2.0 API redesign for `@openslides/motion-diff` that eliminates the primary performance bottleneck by using DocumentFragment-based processing instead of string-based processing.

**Expected Performance Gain**: 30-40% improvement (90% reduction in LineNumbering.insert() calls: 22→2 for 20 changes)

**Trade-off**: Breaking API changes requiring migration of all consumers

---

## Current Architecture Limitations

### Problem: String-Based API Forces Redundant Processing

```typescript
// Current flow for N changes:
for each change:
    1. HTML string → htmlToFragment() → DOM          [parse #1]
    2. insertInternalLineMarkers() creates OS-LINEBREAK from <span>
    3. extractRangeByLineNumbers() queries OS-LINEBREAK
    4. Serialize back to HTML string                 [serialize #1]
    5. replaceLines() merges HTML
    6. serializeDom(stripLineNumbers=true) → string  [serialize #2]
    7. LineNumbering.insert() for next iteration     [parse #2]
```

**Result**: For 20 changes, we parse/serialize 42 times and call LineNumbering.insert() 22 times.

### Root Cause

1. **API is string-based**: All public functions accept/return HTML strings
2. **OS-LINEBREAK elements are DOM-only**: Never serialized to strings
3. **extractRangeByLineNumbers** needs visible `<span class="os-line-number">` to create markers
4. **replaceLines** strips line number spans, forcing re-numbering for next iteration

---

## Proposed v2.0 Architecture

### Core Principle: Keep DOM Throughout Pipeline

```typescript
// Proposed flow for N changes:
1. HTML string → htmlToFragment() → DocumentFragment  [parse once at start]
2. LineNumbering.insertIntoFragment(fragment)        [add line numbers once]

for each change:
    3. extractRangeByLineNumbers(fragment, from, to)  [uses existing markers]
    4. replaceLines(fragment, newHTML, from, to)      [preserves markers]
    
5. Serialize to HTML only at the very end            [serialize once at end]
6. Optional: LineNumbering.insertIntoFragment() if highlighting needed
```

**Result**: For 20 changes, parse once, serialize once, LineNumbering calls: 1-2 times (vs 22).

---

## API Changes

### 1. Core Functions - New Signatures

#### extractRangeByLineNumbers

**Before (v1.x)**:
```typescript
export function extractRangeByLineNumbers(
    html: string,
    fromLine: number,
    toLine: number
): {
    outerContextStart: string;
    outerContextEnd: string;
    innerContextStart: string;
    innerContextEnd: string;
    previousHtml: string;
    html: string;
    followingHtml: string;
    previousHtmlEndSnippet: string;
    followingHtmlStartSnippet: string;
}
```

**After (v2.0)**:
```typescript
export function extractRangeByLineNumbers(
    fragment: DocumentFragment,
    fromLine: number,
    toLine: number
): {
    outerContextStart: DocumentFragment;
    outerContextEnd: DocumentFragment;
    innerContextStart: DocumentFragment;
    innerContextEnd: DocumentFragment;
    previousFragment: DocumentFragment;
    fragment: DocumentFragment;
    followingFragment: DocumentFragment;
    previousFragmentEndSnippet: DocumentFragment;
    followingFragmentStartSnippet: DocumentFragment;
}
```

**Migration Notes**:
- Caller must convert string→fragment before calling
- Results are fragments, not strings
- Use `fragmentToHtml()` utility when string output needed

---

#### replaceLines

**Before (v1.x)**:
```typescript
export function replaceLines(
    oldHtml: string,
    newHTML: string,
    fromLine: number,
    toLine: number
): string
```

**After (v2.0)**:
```typescript
export function replaceLines(
    oldFragment: DocumentFragment,
    newHTML: string | DocumentFragment,
    fromLine: number,
    toLine: number
): DocumentFragment
```

**Key Changes**:
- Input: DocumentFragment instead of string
- Output: DocumentFragment instead of string
- Internal: Use `serializeDom(fragment, stripLineNumbers=false)` to preserve markers
- New parameter type: newHTML can be string OR fragment for flexibility

---

#### getTextWithChanges

**Before (v1.x)**:
```typescript
export function getTextWithChanges(
    motionHtml: string,
    changes: UnifiedChange[],
    lineLength: number,
    highlightLine?: number,
    firstLine?: number
): string
```

**After (v2.0)**:
```typescript
export function getTextWithChanges(
    motionFragment: DocumentFragment,
    changes: UnifiedChange[],
    lineLength: number,
    highlightLine?: number,
    firstLine?: number
): DocumentFragment
```

**Optimization**:
```typescript
// NEW optimized implementation:
export function getTextWithChanges(
    motionFragment: DocumentFragment,
    changes: UnifiedChange[],
    lineLength: number,
    highlightLine?: number,
    firstLine: number = 1
): DocumentFragment {
    if (changes.length === 0) {
        return motionFragment.cloneNode(true) as DocumentFragment;
    }

    // Add line numbers ONCE at start
    LineNumbering.insertIntoFragment(motionFragment, lineLength, highlightLine, undefined, firstLine);
    
    // Apply all changes WITHOUT re-numbering
    for (const change of changes) {
        motionFragment = replaceLines(
            motionFragment,
            change.changeNewText,
            change.lineFrom,
            change.lineTo
        );
        // replaceLines now preserves OS-LINEBREAK markers!
    }
    
    // Optional: Re-apply line numbering only if highlighting needed
    if (highlightLine !== undefined) {
        // Strip old numbers, re-apply with highlighting
        LineNumbering.stripLineNumbers(motionFragment);
        LineNumbering.insertIntoFragment(motionFragment, lineLength, highlightLine, undefined, firstLine);
    }
    
    return motionFragment;
}
```

**Performance**:
- 20 changes: 2 LineNumbering calls (vs 22 in v1.x)
- 90% reduction in most expensive operations

---

### 2. LineNumbering Class Updates

#### New Methods

```typescript
export class LineNumbering {
    /**
     * Insert line numbers into DocumentFragment (new method)
     * Replaces the need for insert() returning string
     */
    public static insertIntoFragment(
        fragment: DocumentFragment,
        lineLength: number,
        highlight?: number,
        color?: string,
        firstLine: number = 1
    ): void {
        // Modify fragment in place
        // Keep OS-LINEBREAK markers
    }
    
    /**
     * Strip line number spans from fragment (new method)
     */
    public static stripLineNumbers(fragment: DocumentFragment): void {
        const lineNumbers = fragment.querySelectorAll('.os-line-number');
        lineNumbers.forEach(span => span.remove());
    }
    
    /**
     * DEPRECATED: Use insertIntoFragment() instead
     */
    public static insert(options: LineNumberingOptions): string {
        // Mark as deprecated, keep for compatibility period
    }
}
```

---

### 3. Internal Functions Updates

#### serializeDom

**Before (v1.x)**:
```typescript
export function serializeDom(
    node: Node,
    stripLineNumbers: boolean = false
): string {
    // Never serializes OS-LINEBREAK
}
```

**After (v2.0)**:
```typescript
export function serializeDom(
    node: Node,
    options: {
        stripLineNumbers?: boolean;
        preserveInternalMarkers?: boolean;  // NEW
    } = {}
): string {
    const stripLineNumbers = options.stripLineNumbers ?? false;
    const preserveInternalMarkers = options.preserveInternalMarkers ?? false;
    
    // When preserveInternalMarkers=true:
    // - Keep OS-LINEBREAK elements in serialized output
    // - Serialize as data attributes or hidden elements
    // This allows round-tripping through strings if needed
}
```

---

#### replaceLinesMergeNodeArrays

**Current Issue**: Complex merging logic for os-split-before/after classes

**v2.0 Enhancement**:
```typescript
export function replaceLinesMergeNodeArrays(
    previous: Node[],
    newNodes: Node[],
    following: Node[],
    preserveMarkers: boolean = true  // NEW parameter
): Node[] {
    // When preserveMarkers=true:
    // - Don't strip .os-line-number spans
    // - Don't strip OS-LINEBREAK elements
    // - Preserve line numbering state through merge
}
```

---

### 4. Utility Functions

#### New Helper Functions

```typescript
/**
 * Convert HTML string to DocumentFragment
 */
export function htmlToFragment(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
}

/**
 * Convert DocumentFragment to HTML string
 */
export function fragmentToHtml(fragment: DocumentFragment): string {
    const div = document.createElement('div');
    const children = Array.prototype.slice.call(fragment.childNodes);
    for (let i = 0; i < children.length; i++) {
        div.appendChild(children[i].cloneNode(true));
    }
    return div.innerHTML;
}

/**
 * Clone DocumentFragment deeply
 */
export function cloneFragment(fragment: DocumentFragment): DocumentFragment {
    return fragment.cloneNode(true) as DocumentFragment;
}
```

---

## Migration Guide

### Phase 1: Package Updates (Breaking)

1. **Update all public function signatures** to use DocumentFragment
2. **Add new LineNumbering methods**: insertIntoFragment(), stripLineNumbers()
3. **Update serializeDom** to support preserveInternalMarkers option
4. **Update replaceLinesMergeNodeArrays** to support preserveMarkers parameter
5. **Add utility functions**: htmlToFragment(), fragmentToHtml(), cloneFragment()
6. **Deprecate old API** but keep for one major version

### Phase 2: Test Updates (Breaking)

**Scope**: 218 tests across 3 files need updates

**Pattern**:

Before:
```typescript
const result = replaceLines(
    '<p>Hello</p>',
    '<p>World</p>',
    1,
    1
);
expect(result).toBe('<p>World</p>');
```

After:
```typescript
const fragment = htmlToFragment('<p>Hello</p>');
const result = replaceLines(
    fragment,
    '<p>World</p>',
    1,
    1
);
expect(fragmentToHtml(result)).toBe('<p>World</p>');
```

**Test Helper Updates**:
```typescript
// Add test helpers
function expectFragmentHtml(fragment: DocumentFragment, expected: string) {
    expect(fragmentToHtml(fragment)).toBe(expected);
}

function createTestFragment(html: string): DocumentFragment {
    return htmlToFragment(html);
}
```

### Phase 3: Client Service Updates (Breaking)

#### motion-line-numbering.service.ts

**Before**:
```typescript
public getTextWithChanges(
    motionHtml: string,
    changes: UnifiedChange[],
    lineLength: number,
    highlight?: number
): string {
    return motionDiff.getTextWithChanges(motionHtml, changes, lineLength, highlight);
}
```

**After**:
```typescript
public getTextWithChanges(
    motionHtml: string,  // Keep string input for service API
    changes: UnifiedChange[],
    lineLength: number,
    highlight?: number
): string {
    // Convert to fragment
    const fragment = motionDiff.htmlToFragment(motionHtml);
    
    // Process as fragment
    const result = motionDiff.getTextWithChanges(fragment, changes, lineLength, highlight);
    
    // Convert back to string
    return motionDiff.fragmentToHtml(result);
}
```

**Note**: Service layer can maintain string-based API for Angular components by wrapping fragment-based package API.

---

#### motion-diff.service.ts

**Approach**: Wrapper layer maintains backward compatibility

```typescript
@Injectable()
export class MotionDiffService {
    // Keep existing string-based methods for components
    public getTextWithChanges(html: string, ...): string {
        const fragment = htmlToFragment(html);
        const result = motionDiff.getTextWithChanges(fragment, ...);
        return fragmentToHtml(result);
    }
    
    // NEW: Add fragment-based methods for advanced use
    public getTextWithChangesFragment(fragment: DocumentFragment, ...): DocumentFragment {
        return motionDiff.getTextWithChanges(fragment, ...);
    }
}
```

---

## Implementation Plan

### Stage 1: Core Package (Week 1)

**Day 1-2**: Update internal functions
- [ ] Modify serializeDom to support preserveInternalMarkers
- [ ] Update replaceLinesMergeNodeArrays to support preserveMarkers
- [ ] Add utility functions (htmlToFragment, fragmentToHtml, cloneFragment)

**Day 3-4**: Update LineNumbering class
- [ ] Add insertIntoFragment() method
- [ ] Add stripLineNumbers() method
- [ ] Deprecate old insert() method

**Day 5**: Update public API
- [ ] Change extractRangeByLineNumbers signature
- [ ] Change replaceLines signature
- [ ] Change getTextWithChanges signature
- [ ] Add backward compatibility warnings

### Stage 2: Tests (Week 2)

**Day 1-3**: Update test infrastructure
- [ ] Add test helper functions
- [ ] Create fragment assertion utilities
- [ ] Update test setup/teardown

**Day 4-5**: Update test cases (218 tests)
- [ ] index.spec.ts (main tests)
- [ ] line-numbering/index.spec.ts
- [ ] dom-helpers.spec.ts
- [ ] Verify all tests pass

### Stage 3: Client Integration (Week 3)

**Day 1-2**: Update motion-line-numbering.service.ts
- [ ] Add fragment conversion wrappers
- [ ] Update method signatures
- [ ] Test with sample motions

**Day 3**: Update motion-diff.service.ts
- [ ] Update service interface
- [ ] Add fragment-based methods
- [ ] Update injection tokens

**Day 4**: Update motion-controller.service.ts
- [ ] Update ViewMotion integration
- [ ] Test with amendment list
- [ ] Verify sorting still works

**Day 5**: Final integration testing
- [ ] Test full amendment workflow
- [ ] Performance profiling
- [ ] Regression testing

### Stage 4: Documentation & Release (Week 4)

**Day 1-2**: Update documentation
- [ ] API reference docs
- [ ] Migration guide
- [ ] Performance benchmarks
- [ ] Breaking changes changelog

**Day 3**: Package release
- [ ] Bump to v2.0.0
- [ ] Publish to npm
- [ ] Tag git release

**Day 4-5**: Monitor & support
- [ ] Watch for issues
- [ ] Support migration questions
- [ ] Quick fixes if needed

---

## Risk Assessment

### High Risk

1. **Breaking all existing consumers**
   - Mitigation: Comprehensive documentation, migration guide
   - Fallback: Maintain v1.x branch for critical fixes

2. **Complex test updates (218 tests)**
   - Mitigation: Systematic approach, test helpers
   - Validation: Run tests after each batch update

3. **Potential bugs in fragment merging**
   - Mitigation: Extensive testing, careful code review
   - Validation: Compare outputs with v1.x on sample data

### Medium Risk

1. **Performance regression in edge cases**
   - Mitigation: Benchmark suite, profiling
   - Validation: Test with large documents (100+ changes)

2. **Browser compatibility issues**
   - Mitigation: Test on all supported browsers
   - Validation: Automated cross-browser testing

3. **Memory leaks with DOM fragments**
   - Mitigation: Proper cleanup, memory profiling
   - Validation: Long-running stress tests

### Low Risk

1. **TypeScript compilation issues**
   - Mitigation: Incremental compilation, type checking
   - Easy to fix during implementation

---

## Success Metrics

### Performance Targets

**LineNumbering.insert() calls**:
- Current (v1.x): 22 calls for 20 changes
- Target (v2.0): 2 calls for 20 changes
- **Goal**: 90% reduction ✓

**Overall performance**:
- Current improvement: 20-35% (v1.x optimizations)
- Target with v2.0: 50-60% total improvement
- **Goal**: 30-40% additional improvement ✓

### Quality Targets

- **Test coverage**: Maintain 100% (218/218 tests passing)
- **Build success**: No TypeScript errors
- **Security**: No new vulnerabilities
- **Backward compatibility**: v1.x maintained for 6 months

---

## Backward Compatibility Strategy

### Dual API Support (Optional)

If maintaining v1.x compatibility in v2.0 is desired:

```typescript
// v2.0 package exports both APIs

// New fragment-based API (default)
export {
    extractRangeByLineNumbers,
    replaceLines,
    getTextWithChanges,
    // ... all fragment-based
} from './v2/index';

// Legacy string-based API (deprecated)
export {
    extractRangeByLineNumbers as extractRangeByLineNumbersLegacy,
    replaceLines as replaceLinesLegacy,
    getTextWithChanges as getTextWithChangesLegacy,
    // ... all string-based
} from './v1-legacy/index';
```

**Trade-off**: Increases package size, maintains more code

**Recommendation**: Clean break in v2.0, maintain v1.x as separate branch

---

## Alternative: Hybrid Approach

If full breaking change is too risky, consider:

### Parallel API (v1.5)

Add fragment-based functions alongside string-based:

```typescript
// Keep existing
export function replaceLines(html: string, ...): string;

// Add new
export function replaceLinesFragment(fragment: DocumentFragment, ...): DocumentFragment;
```

**Pros**:
- No breaking changes
- Gradual migration path
- Can measure adoption

**Cons**:
- Double the API surface
- More maintenance burden
- Consumers won't migrate quickly

---

## Appendix A: Performance Benchmarks

### Expected Performance Comparison

**Test Case**: Process 20 amendments to a 1000-line motion

| Metric | v1.x Current | v1.x Optimized | v2.0 Target |
|--------|--------------|----------------|-------------|
| LineNumbering.insert() calls | 21 | 21 | 2 |
| HTML parse operations | ~42 | ~42 | 2 |
| DOM serialize operations | ~42 | ~42 | 2 |
| Total time (estimated) | 1000ms | 700ms | 450ms |
| Improvement | baseline | 30% | 55% |

### Memory Usage

| Metric | v1.x | v2.0 |
|--------|------|------|
| Peak memory | ~15MB | ~12MB |
| GC pauses | High | Low |
| String allocations | ~840 | ~40 |

---

## Appendix B: Code Examples

### Complete v2.0 Usage Example

```typescript
import {
    htmlToFragment,
    fragmentToHtml,
    getTextWithChanges,
    diff,
    LineNumbering
} from '@openslides/motion-diff';

// Original motion HTML
const motionHtml = '<p>Original text</p>';

// Convert to fragment once
const motionFragment = htmlToFragment(motionHtml);

// Define changes
const changes = [
    {
        lineFrom: 1,
        lineTo: 1,
        changeNewText: '<p>Modified text</p>'
    },
    // ... more changes
];

// Process all changes (fragment stays as DOM)
const resultFragment = getTextWithChanges(
    motionFragment,
    changes,
    80, // lineLength
    5   // highlightLine
);

// Convert to HTML only when needed for display
const resultHtml = fragmentToHtml(resultFragment);
console.log(resultHtml);

// Fragment can be reused for further processing
const diffFragment = diff(resultFragment, anotherFragment, 80, 1);
```

---

## Appendix C: Type Definitions

### New TypeScript Interfaces

```typescript
/**
 * Options for serializeDom
 */
export interface SerializeDomOptions {
    stripLineNumbers?: boolean;
    preserveInternalMarkers?: boolean;
}

/**
 * Result from extractRangeByLineNumbers (v2.0)
 */
export interface ExtractedRangeFragments {
    outerContextStart: DocumentFragment;
    outerContextEnd: DocumentFragment;
    innerContextStart: DocumentFragment;
    innerContextEnd: DocumentFragment;
    previousFragment: DocumentFragment;
    fragment: DocumentFragment;
    followingFragment: DocumentFragment;
    previousFragmentEndSnippet: DocumentFragment;
    followingFragmentStartSnippet: DocumentFragment;
}

/**
 * Options for LineNumbering.insertIntoFragment
 */
export interface FragmentLineNumberingOptions {
    fragment: DocumentFragment;
    lineLength: number;
    highlight?: number;
    color?: string;
    firstLine?: number;
}
```

---

## Conclusion

This v2.0 API redesign provides a clear path to eliminate the primary performance bottleneck while maintaining code quality and correctness. The migration is substantial but well-defined, with clear stages and success metrics.

**Recommended Timeline**: 4 weeks for full implementation and testing

**Recommended Approach**: Clean break to v2.0, maintain v1.x branch for critical fixes

**Expected Outcome**: 50-60% total performance improvement over original implementation

---

## Next Steps

1. **Review this specification** with stakeholders
2. **Approve scope and timeline**
3. **Begin Stage 1 implementation** (Core package updates)
4. **Schedule migration support** for downstream consumers
5. **Plan v2.0.0 release** (target date TBD)

---

**Document Version**: 1.0  
**Author**: GitHub Copilot  
**Date**: 2026-01-17  
**Status**: Proposed
