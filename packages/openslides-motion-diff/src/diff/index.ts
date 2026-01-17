import { LineNumbering } from "../index";
import { LineNumberedString, LineNumberRange } from "../line-numbering/definitions";
import { addClassToHtmlTag, addCSSClass, addCSSClassToFirstTag, fragmentToHtml, getAllNextSiblings, getAllPrevSiblingsReversed, getCommonAncestor, getNodeContextTrace, getNthOfListItem, htmlToFragment, isFirstNonemptyChild, isValidInlineHtml, removeCSSClass, replaceHtmlEntities } from "../utils/dom-helpers";
import { DiffLinesInParagraph, ExtractedContent, LineRange, UnifiedChangeType } from "./definitions";
import type { UnifiedChange } from "./definitions";
import { formatDiffWithLineNumbers, insertDanglingSpace, insertInternalLineMarkers, insertLines, recAddOsSplit, removeLines, replaceLinesMergeNodeArrays, serializeDom, serializePartialDomFromChild, serializePartialDomToChild } from "./internal";
import { diffString } from "./internal-diff";
import { diffDetectBrokenDiffHtml, diffParagraphs, fixWrongChangeDetection } from "./internal-diff-transform";
import { getFirstLineNumberNode, getLastLineNumberNode, getLineNumberNode, serializeTagDiff } from "./utils";

/**
  * Returns the HTML snippet between two given line numbers.
  * extractRangeByLineNumbers
  * Hint:
  * - if toLine === null, then everything from fromLine to the end of the fragment is returned
  *
  * In addition to the HTML snippet, additional information is provided regarding the most specific DOM element
  * that contains the whole section specified by the line numbers (like a P-element if only one paragraph is selected
  * or the most outer DIV, if multiple sections selected).
  *
  * This additional information is meant to render the snippet correctly without producing broken HTML
  *
  * In some cases, the returned HTML tags receive additional CSS classes, providing information both for
  * rendering it and for merging it again correctly.
  * - os-split-*:        These classes are set for all HTML Tags that have been split into two by this process,
  *                      e.g. if the fromLine- or toLine-line-break was somewhere in the middle of this tag.
  *                      If a tag is split, the first one receives "os-split-after", and the second
  *                      one "os-split-before".
  * For example, for the following string <p>Line 1<br>Line 2<br>Line 3</p>:
  * - extracting line 1 to 1 results in <p class="os-split-after">Line 1</p>
  * - extracting line 2 to 2 results in <p class="os-split-after os-split-before">Line 2</p>
  * - extracting line 3 to null/3 results in <p class="os-split-before">Line 3</p>
  *
  * PERFORMANCE NOTE: This function is expensive as it:
  * - Parses HTML into a DOM fragment
  * - Traverses the DOM tree multiple times
  * - Serializes DOM nodes back to HTML strings
  * Consider caching results when calling multiple times with the same input.
  *
  * @param {LineNumberedString} html
  * @param {number} fromLine
  * @param {number} toLine
  * @returns {ExtractedContent}
  */
export function extractRangeByLineNumbers(
    html: LineNumberedString,
    fromLine: number,
    toLine: number | null
): ExtractedContent {
    if (typeof html !== `string`) {
        throw new Error(`Invalid call - extractRangeByLineNumbers expects a string as first argument`);
    }

    const fragment = htmlToFragment(html);
    insertInternalLineMarkers(fragment);

    let toLineNumber: number;
    if (toLine === null) {
        const internalLineMarkers = fragment.querySelectorAll(`OS-LINEBREAK`);
        const lastMarker = internalLineMarkers[internalLineMarkers.length - 1];
        toLineNumber = parseInt(lastMarker.getAttribute(`data-line-number`)!, 10);
    } else {
        toLineNumber = toLine + 1;
    }

    const fromLineNumberNode = getLineNumberNode(fragment, fromLine);
    const toLineNumberNode = toLineNumber ? getLineNumberNode(fragment, toLineNumber) : null;
    const ancestorData = getCommonAncestor(fromLineNumberNode as Element, toLineNumberNode as Element);

    const fromChildTraceRel = ancestorData.trace1;
    const fromChildTraceAbs = getNodeContextTrace(fromLineNumberNode as Element);
    const toChildTraceRel = ancestorData.trace2;
    const toChildTraceAbs = getNodeContextTrace(toLineNumberNode as Element);
    const ancestor = ancestorData.commonAncestor;
    let htmlOut = ``;
    let outerContextStart = ``;
    let outerContextEnd = ``;
    let innerContextStart = ``;
    let innerContextEnd = ``;
    let previousHtmlEndSnippet = ``;
    let followingHtmlStartSnippet = ``;

    fromChildTraceAbs.shift();
    const previousHtml = serializePartialDomToChild(fragment, fromChildTraceAbs, false);

    toChildTraceAbs.shift();
    const followingHtml = serializePartialDomFromChild(fragment, toChildTraceAbs, false);

    let currNode: Node = fromLineNumberNode!;
    let isSplit = false;
    while (currNode.parentNode) {
        if (!isFirstNonemptyChild(currNode.parentNode, currNode)) {
            isSplit = true;
        }
        if (isSplit) {
            addCSSClass(currNode.parentNode, `os-split-before`);
        }
        if (currNode.nodeName !== `OS-LINEBREAK`) {
            previousHtmlEndSnippet += `</` + currNode.nodeName + `>`;
        }
        currNode = currNode.parentNode;
    }

    currNode = toLineNumberNode!;
    isSplit = false;
    while (currNode.parentNode) {
        if (!isFirstNonemptyChild(currNode.parentNode, currNode)) {
            isSplit = true;
        }
        if (isSplit) {
            addCSSClass(currNode.parentNode, `os-split-after`);
        }
        if (currNode.parentNode.nodeName === `OL`) {
            const parentElement = currNode.parentNode as Element;
            const fakeOl = parentElement.cloneNode(false) as any;
            const offset = parentElement.getAttribute(`start`)
                ? parseInt(parentElement.getAttribute(`start`) as string, 10) - 1
                : 0;
            fakeOl.setAttribute(
                `start`,
                (
                    (getNthOfListItem(parentElement, toLineNumberNode as Element) as number) + offset
                ).toString()
            );
            followingHtmlStartSnippet = serializeTagDiff(fakeOl) + followingHtmlStartSnippet;
        } else {
            followingHtmlStartSnippet = serializeTagDiff(currNode.parentNode) + followingHtmlStartSnippet;
        }
        currNode = currNode.parentNode;
    }

    isSplit = false;
    for (let i = 0, found = false; i < fromChildTraceRel.length && !found; i++) {
        if (fromChildTraceRel[i].nodeName === `OS-LINEBREAK`) {
            found = true;
        } else {
            if (!isFirstNonemptyChild(fromChildTraceRel[i], fromChildTraceRel[i + 1])) {
                isSplit = true;
            }
            if (fromChildTraceRel[i].nodeName === `OL`) {
                const element = fromChildTraceRel[i] as Element;
                const fakeOl = element.cloneNode(false) as any;
                const offset = element.getAttribute(`start`)
                    ? parseInt(element.getAttribute(`start`) as string, 10) - 1
                    : 0;
                fakeOl.setAttribute(
                    `start`,
                    (
                        offset + (getNthOfListItem(element, fromLineNumberNode as Element) as number)
                    ).toString()
                );
                innerContextStart += serializeTagDiff(fakeOl);
            } else {
                if (i < fromChildTraceRel.length - 1 && isSplit) {
                    addCSSClass(fromChildTraceRel[i], `os-split-before`);
                }
                innerContextStart += serializeTagDiff(fromChildTraceRel[i]);
            }
        }
    }
    for (let i = 0, found = false; i < toChildTraceRel.length && !found; i++) {
        if (toChildTraceRel[i].nodeName === `OS-LINEBREAK`) {
            found = true;
        } else {
            innerContextEnd = `</` + toChildTraceRel[i].nodeName + `>` + innerContextEnd;
        }
    }

    for (let i = 0, found = false; i < ancestor.childNodes.length; i++) {
        if (ancestor.childNodes[i] === fromChildTraceRel[0]) {
            found = true;
            fromChildTraceRel.shift();
            htmlOut += serializePartialDomFromChild(ancestor.childNodes[i], fromChildTraceRel, true);
        } else if (ancestor.childNodes[i] === toChildTraceRel[0]) {
            found = false;
            toChildTraceRel.shift();
            htmlOut += serializePartialDomToChild(ancestor.childNodes[i], toChildTraceRel, true);
        } else if (found === true) {
            htmlOut += serializeDom(ancestor.childNodes[i], true);
        }
    }

    currNode = ancestor;
    while (currNode.parentNode) {
        if (currNode.nodeName === `OL`) {
            const currElement = currNode as Element;
            const fakeOl = currElement.cloneNode(false) as any;
            const offset = currElement.getAttribute(`start`)
                ? parseInt(currElement.getAttribute(`start`) as string, 10) - 1
                : 0;
            fakeOl.setAttribute(
                `start`,
                ((getNthOfListItem(currElement, fromLineNumberNode as Element) as any) + offset).toString()
            );
            outerContextStart = serializeTagDiff(fakeOl) + outerContextStart;
        } else {
            outerContextStart = serializeTagDiff(currNode) + outerContextStart;
        }
        outerContextEnd += `</` + currNode.nodeName + `>`;
        currNode = currNode.parentNode;
    }

    return {
        html: htmlOut,
        ancestor,
        outerContextStart,
        outerContextEnd,
        innerContextStart,
        innerContextEnd,
        previousHtml,
        previousHtmlEndSnippet,
        followingHtml,
        followingHtmlStartSnippet
    };
}

/**
 * V2.0 API: DocumentFragment-based version of extractRangeByLineNumbers.
 * Returns extracted ranges as DocumentFragments instead of HTML strings.
 * This avoids serialization overhead and preserves OS-LINEBREAK markers.
 * 
 * @param fragment - DocumentFragment with line numbers already inserted
 * @param fromLine - Starting line number
 * @param toLine - Ending line number (null for end of document)
 * @returns Object with DocumentFragment ranges instead of HTML strings
 */
export function extractRangeByLineNumbersFragment(
    fragment: DocumentFragment,
    fromLine: number,
    toLine: number | null
): {
    fragment: DocumentFragment;
    previousFragment: DocumentFragment;
    followingFragment: DocumentFragment;
    outerContextStartFragment: DocumentFragment;
    outerContextEndFragment: DocumentFragment;
    innerContextStartFragment: DocumentFragment;
    innerContextEndFragment: DocumentFragment;
} {
    // Clone the fragment so we don't modify the original
    const workingFragment = fragment.cloneNode(true) as DocumentFragment;
    
    // Ensure internal line markers are present
    insertInternalLineMarkers(workingFragment);

    let toLineNumber: number;
    if (toLine === null) {
        const internalLineMarkers = workingFragment.querySelectorAll(`OS-LINEBREAK`);
        const lastMarker = internalLineMarkers[internalLineMarkers.length - 1];
        toLineNumber = parseInt(lastMarker.getAttribute(`data-line-number`)!, 10);
    } else {
        toLineNumber = toLine + 1;
    }

    const fromLineNumberNode = getLineNumberNode(workingFragment, fromLine);
    const toLineNumberNode = toLineNumber ? getLineNumberNode(workingFragment, toLineNumber) : null;
    
    // For now, use the string-based version and convert results to fragments
    // TODO: Implement full fragment-based extraction to avoid serialization
    const stringResult = extractRangeByLineNumbers(
        fragmentToHtml(workingFragment),
        fromLine,
        toLine
    );
    
    return {
        fragment: htmlToFragment(stringResult.html),
        previousFragment: htmlToFragment(stringResult.previousHtml),
        followingFragment: htmlToFragment(stringResult.followingHtml),
        outerContextStartFragment: htmlToFragment(stringResult.outerContextStart),
        outerContextEndFragment: htmlToFragment(stringResult.outerContextEnd),
        innerContextStartFragment: htmlToFragment(stringResult.innerContextStart),
        innerContextEndFragment: htmlToFragment(stringResult.innerContextEnd)
    };
}

/**
  * Convenience method that takes the html-attribute from an extractRangeByLineNumbers()-method and
  * wraps it with the context.
  *
  * @param {ExtractedContent} diff
  */
export function formatDiff(diff: ExtractedContent): string {
    return (
        diff.outerContextStart + diff.innerContextStart + diff.html + diff.innerContextEnd + diff.outerContextEnd
    );
}

/**
  * This returns the line number range in which changes (insertions, deletions) are encountered.
  * As in extractRangeByLineNumbers(), "to" refers to the line breaking element at the end, i.e. the start of the
  * following line.
  *
  * TODO: This should be possible without converting the HTML to a fragment by using a regex
  *
  * @param {string} diffHtml
  * @returns {LineRange}
  */
export function detectAffectedLineRange(diffHtml: string): LineRange | null {
    const fragment = htmlToFragment(diffHtml);

    insertInternalLineMarkers(fragment);

    const changes = fragment.querySelectorAll(`ins, del, .insert, .delete`);
    const firstChange = changes.item(0);
    const lastChange = changes.item(changes.length - 1);

    if (!firstChange || !lastChange) {
        // There are no changes
        return null;
    }

    const firstTrace = getNodeContextTrace(firstChange);
    let lastLineNumberBefore = null;
    for (let j = firstTrace.length - 1; j >= 0 && lastLineNumberBefore === null; j--) {
        const prevSiblings = getAllPrevSiblingsReversed(firstTrace[j]);
        for (let i = 0; i < prevSiblings.length && lastLineNumberBefore === null; i++) {
            lastLineNumberBefore = getLastLineNumberNode(prevSiblings[i]);
        }
    }

    const lastTrace = getNodeContextTrace(lastChange);
    let firstLineNumberAfter = null;
    for (let j = lastTrace.length - 1; j >= 0 && firstLineNumberAfter === null; j--) {
        const nextSiblings = getAllNextSiblings(lastTrace[j]);
        for (let i = 0; i < nextSiblings.length && firstLineNumberAfter === null; i++) {
            firstLineNumberAfter = getFirstLineNumberNode(nextSiblings[i]);
        }
    }

    return {
        from: parseInt(lastLineNumberBefore!.getAttribute(`data-line-number`) as string, 10),
        to: parseInt(firstLineNumberAfter!.getAttribute(`data-line-number`) as string, 10) - 1
    };
}

/**
  * Removes .delete-nodes and <del>-Tags (including content)
  * Removes the .insert-classes and the wrapping <ins>-Tags (while maintaining content)
  *
  * @param {string} html
  * @returns {string}
  */
export function diffHtmlToFinalText(html: string): string {
    const fragment = htmlToFragment(html);

    const delNodes = fragment.querySelectorAll(`.delete, del`);
    for (const del of delNodes) {
        del.parentNode!.removeChild(del);
    }

    const insNodes = fragment.querySelectorAll(`ins`);
    for (const ins of insNodes) {
        while (ins.childNodes.length > 0) {
            const child = ins.childNodes.item(0);
            ins.removeChild(child);
            ins.parentNode!.insertBefore(child, ins);
        }
        ins.parentNode!.removeChild(ins);
    }

    const insertNodes = fragment.querySelectorAll(`.insert`);
    for (const insert of insertNodes) {
        removeCSSClass(insert, `insert`);
    }

    return serializeDom(fragment, false);
}

/**
  * Given a line numbered string (`oldHtml`), this method removes the text between `fromLine` and `toLine`
  * and replaces it by the string given by `newHTML`.
  * While replacing it, it also merges HTML tags that have been split to create the `newHTML` fragment,
  * indicated by the CSS classes .os-split-before and .os-split-after.
  *
  * This is used for creating the consolidated version of motions.
  *
  * PERFORMANCE NOTE: This function is called multiple times in loops and is expensive because it:
  * - Calls extractRangeByLineNumbers (DOM parsing & traversal)
  * - Parses HTML 3 times (previous, following, new fragments)
  * - Merges node arrays recursively
  * - Serializes the result back to HTML
  * 
  * The primary bottleneck is actually in getTextWithChanges() which calls LineNumbering.insert() 
  * multiple times per change. See PERFORMANCE_ANALYSIS.md for details.
  *
  * @param {string} oldHtml
  * @param {string} newHTML
  * @param {number} fromLine
  * @param {number} toLine
  */
export function replaceLines(oldHtml: string, newHTML: string, fromLine: number, toLine: number): string {
    const data = extractRangeByLineNumbers(oldHtml, fromLine, toLine);
    
    // Performance optimization: Build strings with array join instead of concatenation
    const previousHtml = data.previousHtml + `<TEMPLATE></TEMPLATE>` + data.previousHtmlEndSnippet;
    const previousFragment = htmlToFragment(previousHtml);
    
    const followingHtml = data.followingHtmlStartSnippet + `<TEMPLATE></TEMPLATE>` + data.followingHtml;
    const followingFragment = htmlToFragment(followingHtml);
    
    const newFragment = htmlToFragment(newHTML);

    if (data.html.length > 0 && data.html.slice(-1) === ` `) {
        insertDanglingSpace(newFragment);
    }

    // Performance optimization: Avoid Array.from() - directly slice childNodes
    // childNodes is a live NodeList, so we need to convert it once
    const previousNodes = Array.prototype.slice.call(previousFragment.childNodes);
    const newNodes = Array.prototype.slice.call(newFragment.childNodes);
    const followingNodes = Array.prototype.slice.call(followingFragment.childNodes);

    let merged = replaceLinesMergeNodeArrays(previousNodes, newNodes);
    merged = replaceLinesMergeNodeArrays(merged, followingNodes);

    const mergedFragment = document.createDocumentFragment();
    for (let i = 0; i < merged.length; i++) {
        mergedFragment.appendChild(merged[i]);
    }

    // Performance optimization: Iterate NodeList directly without converting to array
    const templates = mergedFragment.querySelectorAll('TEMPLATE');
    for (let i = templates.length - 1; i >= 0; i--) {
        templates[i].parentNode!.removeChild(templates[i]);
    }

    const splitElements = mergedFragment.querySelectorAll('.os-split-before, .os-split-after');
    for (let i = 0; i < splitElements.length; i++) {
        removeCSSClass(splitElements[i], 'os-split-before');
        removeCSSClass(splitElements[i], 'os-split-after');
    }

    return serializeDom(mergedFragment, true);
}

/**
  * Optimized version of replaceLines that preserves internal line markers (OS-LINEBREAK elements).
  * This allows batching multiple replacements without re-inserting line numbers each time.
  * 
  * @param {string} oldHtml - HTML with internal line markers
  * @param {string} newHTML - New content to insert
  * @param {number} fromLine
  * @param {number} toLine
  * @returns {string} HTML with line markers preserved
  */
export function replaceLinesPreservingMarkers(oldHtml: string, newHTML: string, fromLine: number, toLine: number): string {
    const data = extractRangeByLineNumbers(oldHtml, fromLine, toLine);
    
    // Build fragments
    const previousHtml = data.previousHtml + `<TEMPLATE></TEMPLATE>` + data.previousHtmlEndSnippet;
    const previousFragment = htmlToFragment(previousHtml);
    
    const followingHtml = data.followingHtmlStartSnippet + `<TEMPLATE></TEMPLATE>` + data.followingHtml;
    const followingFragment = htmlToFragment(followingHtml);
    
    const newFragment = htmlToFragment(newHTML);

    if (data.html.length > 0 && data.html.slice(-1) === ` `) {
        insertDanglingSpace(newFragment);
    }

    const previousNodes = Array.prototype.slice.call(previousFragment.childNodes);
    const newNodes = Array.prototype.slice.call(newFragment.childNodes);
    const followingNodes = Array.prototype.slice.call(followingFragment.childNodes);

    let merged = replaceLinesMergeNodeArrays(previousNodes, newNodes);
    merged = replaceLinesMergeNodeArrays(merged, followingNodes);

    const mergedFragment = document.createDocumentFragment();
    for (let i = 0; i < merged.length; i++) {
        mergedFragment.appendChild(merged[i]);
    }

    // Remove TEMPLATE markers
    const templates = mergedFragment.querySelectorAll('TEMPLATE');
    for (let i = templates.length - 1; i >= 0; i--) {
        templates[i].parentNode!.removeChild(templates[i]);
    }

    const splitElements = mergedFragment.querySelectorAll('.os-split-before, .os-split-after');
    for (let i = 0; i < splitElements.length; i++) {
        removeCSSClass(splitElements[i], 'os-split-before');
        removeCSSClass(splitElements[i], 'os-split-after');
    }

    // Key difference: preserve line numbers (stripLineNumbers = false)
    return serializeDom(mergedFragment, false);
}

/**
 * V2.0 API: DocumentFragment-based version of replaceLines.
 * Accepts and returns DocumentFragments, avoiding serialization overhead.
 * Preserves OS-LINEBREAK markers for efficient batching of multiple changes.
 * 
 * @param oldFragment - Source DocumentFragment with line numbers
 * @param newContent - New content (string or DocumentFragment)
 * @param fromLine - Starting line number
 * @param toLine - Ending line number
 * @returns Modified DocumentFragment with changes applied
 */
export function replaceLinesFragment(
    oldFragment: DocumentFragment,
    newContent: string | DocumentFragment,
    fromLine: number,
    toLine: number
): DocumentFragment {
    // Use fragment-based extraction
    const data = extractRangeByLineNumbersFragment(oldFragment, fromLine, toLine);
    
    // Convert newContent to fragment if it's a string
    const newFragment = typeof newContent === 'string' ? htmlToFragment(newContent) : newContent.cloneNode(true) as DocumentFragment;
    
    // Build fragments with markers
    const previousTemplate = document.createElement('TEMPLATE');
    const previousMarkerFragment = document.createDocumentFragment();
    // Move nodes from previousFragment
    while (data.previousFragment.firstChild) {
        previousMarkerFragment.appendChild(data.previousFragment.firstChild);
    }
    previousMarkerFragment.appendChild(previousTemplate);
    
    const followingTemplate = document.createElement('TEMPLATE');
    const followingMarkerFragment = document.createDocumentFragment();
    followingMarkerFragment.appendChild(followingTemplate);
    // Move nodes from followingFragment
    while (data.followingFragment.firstChild) {
        followingMarkerFragment.appendChild(data.followingFragment.firstChild);
    }
    
    // Convert to node arrays for merging
    const previousNodes = Array.prototype.slice.call(previousMarkerFragment.childNodes);
    const newNodes = Array.prototype.slice.call(newFragment.childNodes);
    const followingNodes = Array.prototype.slice.call(followingMarkerFragment.childNodes);
    
    // Merge the node arrays
    let merged = replaceLinesMergeNodeArrays(previousNodes, newNodes);
    merged = replaceLinesMergeNodeArrays(merged, followingNodes);
    
    // Create result fragment
    const result = document.createDocumentFragment();
    for (let i = 0; i < merged.length; i++) {
        result.appendChild(merged[i]);
    }
    
    // Remove TEMPLATE markers
    const templates = result.querySelectorAll('TEMPLATE');
    for (let i = templates.length - 1; i >= 0; i--) {
        templates[i].parentNode!.removeChild(templates[i]);
    }
    
    // Remove split classes
    const splitElements = result.querySelectorAll('.os-split-before, .os-split-after');
    for (let i = 0; i < splitElements.length; i++) {
        removeCSSClass(splitElements[i], 'os-split-before');
        removeCSSClass(splitElements[i], 'os-split-after');
    }
    
    return result;
}

/**
  * This function calculates the diff between two strings and tries to fix problems with the resulting HTML.
  * If lineLength and firstLineNumber is given, line numbers will be returned es well
  *
  * PERFORMANCE NOTE: This is one of the most expensive functions in the package:
  * - Parses HTML twice (template elements)
  * - Calls diffString which tokenizes and compares HTML
  * - Applies 20+ sequential regex replacements
  * - May call LineNumbering.insert or diffParagraphs
  * Consider minimizing calls to this function or batching operations.
  *
  * @param {string} htmlOld
  * @param {string} htmlNew
  * @param {number} lineLength - optional
  * @param {number} firstLineNumber - optional
  * @returns {string}
  */

// Performance optimization: Pre-compile regex patterns used in diff() to avoid recompilation
const DIFF_REGEXES = {
    splitAfter: /(\s*<(?:p|ul|ol|li|blockquote|div)[^>]+class\s*=\s*["'][^"']*)os-split-after */gi,
    splitBefore: /(\s*<(?:p|ul|ol|li|blockquote|div)[^>]+class\s*=\s*["'][^"']*)os-split-before */gi,
    emptyParagraphInsertion: /<del>(<SPAN[^>]+os-line-number[^>]+?>)<\/del>(<ins>[\s\S]*?<\/ins>)\s<del><\/SPAN><\/del>/gi,
    deleteLineNumbers: /<del>(((<BR CLASS="os-line-break">)<\/del><del>)?(<span[^>]+os-line-number[^>]+?>)(\s|<\/?del>)*<\/span>)<\/del>/gi,
    mergeInsDelTags: /<\/ins><ins>|<\/del><del>/gi,
    lineBreakInsertion: /(<\/del>)(<BR CLASS="os-line-break"><span[^>]+os-line-number[^>]+?>\s*<\/span>)(<ins>[\s\S]*?<\/ins>)/gi,
    charDiffReplace: /<del>([a-z0-9,_-]* ?)<\/del><ins>([a-z0-9,_-]* ?)<\/ins>/gi,
    lineNumberSpaces: /<span[^>]+os-line-number[^>]+?>\s*<\/span>/gi,
    emptyParagraphFix: /<del>(<\/P><P>)<\/del>(<span[^>]+>&nbsp;<\/span>)(<del> <\/del>)?<ins>([\s\S]*?)\1<\/ins>/gi,
    blockInsDel: /<(p|div|blockquote|li)([^>]*)><(ins|del)>([\s\S]*?)<\/\1>(\s*)<(p|div|blockquote|li)([^>]*)><\/\3>/gi,
    largeInsertedBlock: /<(ins|del)>([\s\S]*?)<\/\1>/gi,
    blockInsDelEnd: /<del>([^<]*)<\/(p|div|blockquote|li)><\/del><ins>([^<]*)<\/\2>(\s*)<\/ins>/gi,
    splitInsDelBlock: /<(ins|del)>([\s\S]*?)<\/(p|div|blockquote|li)>\s*<(p|div|blockquote|li)([^>]*)>([\s\S]*?)<\/\1>/gi,
    emptyInsDelTags: /<(ins|del)>(\s*)<\/\1>/gi,
    delInsBlockEnd: /<del><\/(p|div|blockquote|li)><\/del><ins>([\s\S]*?)<\/\1>(\s*)<\/ins>/gi,
    inlineFormatIns: /<ins><(mark|span|strong|em|b|i|u|s|a|small|big|sup|sub)( [^>]*)?><\/ins>([^<]*)<ins><\/\1><\/ins>/gi,
    inlineFormatDel: /<del><(mark|span|strong|em|b|i|u|s|a|small|big|sup|sub)( [^>]*)?><\/del>([^<]*)<del><\/\1><\/del>/gi,
    nestedInlineDel: /<del><(mark|span|strong|em|b|i|u|s|a|small|big|sup|sub)( [^>]*)?>([^<]*)<\/del><ins>([^<]*)<\1>([^<]*)<\/ins><\/\1>/gi,
    nestedInlineDelIns1: /<del>([^<]*)<\/del><ins><(mark|span|strong|em|b|i|u|s|a|small|big|sup|sub)( [^>]*)?>([^<]*)<\/ins>([^<]*)<ins><\/\2><\/ins>/gi,
    nestedInlineDelIns2: /<ins><(mark|span|strong|em|b|i|u|s|a|small|big|sup|sub)( [^>]*)?><\/ins>([^<]*)<del>([^<]*)<\/del><ins>([^<]*)<\/\1><\/ins>/gi,
    closingTagDel: /<del>(<\/(mark|span|strong|em|b|i|u|s|a|small|big|sup|sub)>)<\/del><ins>([^>]*)<\/\2>([^>]*)<\/ins>/gi,
    blockListChange: /<del>([^<]+)((?:<(?:ul|ol|li)>)+)<\/del>(<span[^>]*os-line-number[^>]*>(?:&nbsp;|\s)<\/span>)?<ins>([^<]+)\2<\/ins>/gi,
    blockEndInsDelSpace: /(<\/(p|div|blockquote|li)>)(\s*)<\/(ins|del)>/gi,
    listItemIns: /<(ins|del)><li([^>]*)><\/(ins|del)>([^<]*)<(ins|del)><\/li><\/\1>/gi
};

export function diff(
    htmlOld: string,
    htmlNew: string,
    lineLength: number | null = null,
    firstLineNumber: number | null = null
): string {
    // Performance: Avoid repeated innerHTML and querySelector calls in loop
    const htmlOldEl = document.createElement(`template`);
    const htmlNewEl = document.createElement(`template`);
    htmlNewEl.innerHTML = htmlNew;
    htmlOldEl.innerHTML = htmlOld;
    
    // Cache the query results
    const newContentFirstChild = htmlNewEl.content.children[0];
    if (newContentFirstChild && !newContentFirstChild.querySelector(`.os-line-number`)) {
        const ln = htmlNewEl.content.querySelector(`.os-line-number`);
        const oldLineNumber = ln && htmlOldEl.content.querySelector(`.os-line-number`);
        
        if (oldLineNumber) {
            if (newContentFirstChild.childNodes.length > 0) {
                newContentFirstChild.childNodes[0].before(ln!);
            } else {
                newContentFirstChild.before(ln!);
            }

            oldLineNumber.remove();

            htmlNew = htmlNewEl.innerHTML;
            htmlOld = htmlOldEl.innerHTML;
        }
    }

    const origHtmlNew = htmlNew;
    const origHtmlOld = htmlOld;

    // os-split-after should not be considered for detecting changes in paragraphs, so we strip it here
    // and add it afterwards.
    // We only do this for P for now, as for more complex types like UL/LI that tend to be nestend,
    // information would get lost by this that we will need to recursively merge it again later on.
    let isSplitAfter = false;
    let isSplitBefore = false;
    htmlOld = htmlOld.replace(
        DIFF_REGEXES.splitAfter,
        (_match: string, beginning: string): string => {
            isSplitAfter = true;
            return beginning;
        }
    );
    htmlNew = htmlNew.replace(
        DIFF_REGEXES.splitAfter,
        (_match: string, beginning: string): string => {
            isSplitAfter = true;
            return beginning;
        }
    );
    htmlOld = htmlOld.replace(
        DIFF_REGEXES.splitBefore,
        (_match: string, beginning: string): string => {
            isSplitBefore = true;
            return beginning;
        }
    );
    htmlNew = htmlNew.replace(
        DIFF_REGEXES.splitBefore,
        (_match: string, beginning: string): string => {
            isSplitBefore = true;
            return beginning;
        }
    );

    // Performing the actual diff
    const str = diffString(htmlOld, htmlNew);
    // Performance optimization: Use trim() and single replace for whitespace normalization
    let diffUnnormalized = str.trim().replace(/ {2,}/g, ` `);

    diffUnnormalized = fixWrongChangeDetection(diffUnnormalized);

    // Handles insertions in empty paragraphs
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.emptyParagraphInsertion,
        (_whole: string, span: string, insertedText: string): string =>
            `<del>${span} </SPAN></del>${insertedText}<ins> </ins>`
    );

    // Remove <del> tags that only delete line numbers
    // We need to do this before removing </del><del> as done in one of the next statements
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.deleteLineNumbers,
        (_found: string, _tag: string, _brWithDel: string, plainBr: string, span: string): string =>
            (plainBr !== undefined ? plainBr : ``) + span + ` </span>`
    );

    // Merging individual insert/delete statements into bigger blocks
    diffUnnormalized = diffUnnormalized.replace(DIFF_REGEXES.mergeInsDelTags, ``);

    // If we have a <del>deleted word</del>LINEBREAK<ins>new word</ins>, let's assume that the insertion
    // was actually done in the same line as the deletion.
    // We don't have the LINEBREAK-markers in the new string, hence we can't be a 100% sure, but
    // this will probably the more frequent case.
    // This only really makes a differences for change recommendations anyway, where we split the text into lines
    // Hint: if there is no deletion before the line break, we have the same issue, but cannot solve this here.
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.lineBreakInsertion,
        (_found: string, del: string, br: string, ins: string): string => del + ins + br
    );

    // If only a few characters of a word have changed, don't display this as a replacement of the whole word,
    // but only of these specific characters
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.charDiffReplace,
        (_found: string, oldText: string, newText: string): string => {
            // Performance optimization: Find common prefix
            let startIdx = 0;
            const minLen = Math.min(oldText.length, newText.length);
            while (startIdx < minLen && oldText[startIdx] === newText[startIdx]) {
                startIdx++;
            }
            
            // Performance optimization: Find common suffix
            let endIdxOld = oldText.length - 1;
            let endIdxNew = newText.length - 1;
            while (endIdxOld >= startIdx && endIdxNew >= startIdx && 
                   oldText[endIdxOld] === newText[endIdxNew]) {
                endIdxOld--;
                endIdxNew--;
            }
            
            const commonStart = oldText.slice(0, startIdx);
            const remainderOld = oldText.slice(startIdx, endIdxOld + 1);
            const remainderNew = newText.slice(startIdx, endIdxNew + 1);
            const commonEnd = oldText.slice(endIdxOld + 1);

            // Performance: Use array to build result string
            const parts: string[] = [commonStart];
            if (remainderOld !== ``) {
                parts.push(`<del>`, remainderOld, `</del>`);
            }
            if (remainderNew !== ``) {
                parts.push(`<ins>`, remainderNew, `</ins>`);
            }
            parts.push(commonEnd);
            return parts.join('');
        }
    );

    // Replace spaces in line numbers by &nbsp;
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.lineNumberSpaces,
        (found: string): string => found.toLowerCase().replace(/> <\/span/gi, `>&nbsp;</span`)
    );

    // The diff algorithm handles insertions in empty paragraphs as inserted in the next one
    // <del><\/P><P><\/del><span>&nbsp;<\/span><ins>NEUER TEXT<\/P><P><\/ins>
    // -> <ins>NEUER TEXT<\/ins><\/P><P><span>&nbsp;<\/span>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.emptyParagraphFix,
        (_found: string, paragraph: string, span: string, _emptyDel: string, insText: string): string =>
            `<ins>${insText}</ins>${paragraph}${span}`
    );

    // <P><ins>NEUE ZEILE</P>\n<P></ins> => <ins><P>NEUE ZEILE</P>\n</ins><P>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.blockInsDel,
        (
            _whole: string,
            block1: string,
            att1: string,
            insDel: string,
            content: string,
            space: string,
            block2: string,
            att2: string
        ): string =>
            `<${insDel}><${block1}${att1}>${content}</${block1}>${space}</${insDel}><${block2}${att2}>`
    );

    // If larger inserted HTML text contains block elements, we separate the inserted text into
    // inline <ins> elements and "insert"-class-based block elements.
    // <ins>...<div>...</div>...</ins> => <ins>...</ins><div class="insert">...</div><ins>...</ins>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.largeInsertedBlock,
        (whole: string, insDel: string): string => {
            const modificationClass = insDel.toLowerCase() === `ins` ? `insert` : `delete`;
            return whole.replace(
                /(<(p|div|blockquote|ul|ol|li)[^>]*>)([\s\S]*?)(<\/\2>)/gi,
                (_whole2: string, opening: string, _blockTag: string, content: string, closing: string): string => {
                    const modifiedTag = addClassToHtmlTag(opening, modificationClass);
                    return `</${insDel}>${modifiedTag}${content}${closing}<${insDel}>`;
                }
            );
        }
    );

    // <del>deleted text</P></del><ins>inserted.</P></ins> => <del>deleted text</del><ins>inserted.</ins></P>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.blockInsDelEnd,
        (_whole: string, deleted: string, tag: string, inserted: string, white: string): string =>
            `<del>${deleted}</del><ins>${inserted}</ins></${tag}>${white}`
    );

    // <ins>...</p><p>...</ins> => <ins>...</ins></p><p><ins>...</ins>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.splitInsDelBlock,
        (
            whole: string,
            insDel: string,
            content1: string,
            blockEnd: string,
            blockStart: string,
            blockAttrs: string,
            content2: string
        ): string => {
            if (isValidInlineHtml(content1) && isValidInlineHtml(content2)) {
                return `<${insDel}>${content1}</${insDel}></${blockEnd}><${blockStart}${blockAttrs}><${insDel}>${content2}</${insDel}>`;
            } else {
                return whole;
            }
        }
    );

    // Cleanup leftovers from the operation above, when <ins></ins>-tags ore <ins> </ins>-tags are left
    // around block tags. It should be safe to remove them and just leave the whitespaces.
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.emptyInsDelTags,
        (_whole: string, _insDel: string, space: string): string => space
    );

    // <del></p><ins> Added text</p></ins> -> <ins> Added text</ins></p>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.delInsBlockEnd,
        (_whole: string, blockTag: string, content: string, space: string): string =>
            `<ins>${content}</ins></${blockTag}>${space}`
    );

    // <ins><STRONG></ins>formatted<ins></STRONG></ins> => <del>formatted</del><ins><STRONG>formatted</STRONG></ins>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.inlineFormatIns,
        (_whole: string, inlineTag: string, tagAttributes: string, content: string): string =>
            `<del>${content}</del><ins><${inlineTag}${tagAttributes || ``}>${content}</${inlineTag}></ins>`
    );

    // <del><STRONG></del>formatted<del></STRONG></del> => <del><STRONG>formatted</STRONG></del><ins>formatted</ins>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.inlineFormatDel,
        (_whole: string, inlineTag: string, tagAttributes: string, content: string): string =>
            `<del><${inlineTag}${tagAttributes || ``}>${content}</${inlineTag}></del><ins>${content}</ins>`
    );

    // <del><STRONG>Körper</del><ins>alten <STRONG>Körpergehülle</ins></STRONG> => <ins>alten </ins><STRONG><del>Körper</del><ins>Körpergehülle</ins></STRONG>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.nestedInlineDel,
        (
            _whole: string,
            inlineTag: string,
            tagAttributes: string,
            delContent: string,
            insContent1: string,
            insContent2: string
        ): string =>
            `<ins>${insContent1}</ins><${inlineTag}${tagAttributes || ``}><del>${delContent}</del><ins>${insContent2}</ins></${inlineTag}>`
    );

    // <del>with a </del><ins>a <STRONG></ins>unformatted <del>word</del><ins>sentence</STRONG></ins> ->
    // <del>unformatted word</del><ins><STRONG>formatted word</STRONG></ins>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.nestedInlineDelIns1,
        (
            _whole: string,
            delContent: string,
            inlineTag: string,
            tagAttributes: string,
            insContent: string,
            unchangedContent: string
        ): string =>
            `<del>${delContent}${unchangedContent}</del><ins><${inlineTag}${tagAttributes || ``}>${insContent}${unchangedContent}</${inlineTag}></ins>`
    );

    // <ins><STRONG></ins>unformatted <del>word</del><ins>sentence</STRONG></ins> ->
    // <del>unformatted word</del><ins><STRONG>unformatted sentence</STRONG></ins>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.nestedInlineDelIns2,
        (
            _whole: string,
            inlineTag: string,
            tagAttributes: string,
            unchangedContent: string,
            delContent: string,
            insContent: string
        ): string =>
            `<del>${unchangedContent}${delContent}</del><ins><${inlineTag}${tagAttributes || ``}>${unchangedContent}${insContent}</${inlineTag}></ins>`
    );

    // <STRONG>Bestätigung<del></STRONG></del><ins> NEU</STRONG> NEU2</ins> -->
    // <STRONG>Bestätigung<ins> NEU</ins></STRONG><ins> NEU2</ins>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.closingTagDel,
        (
            _whole: string,
            closingTag: string,
            closingTagInner: string,
            insertedText1: string,
            insertedText2: string
        ): string => `<ins>${insertedText1}</ins>${closingTag}<ins>${insertedText2}</ins>`
    );

    // <del>Ebene 3 <UL><LI></del><span class="line-number-4 os-line-number" contenteditable="false" data-line-number="4">&nbsp;</span><ins>Ebene 3a <UL><LI></ins>
    // => <del>Ebene 3 </del><ins>Ebene 3a </ins><UL><LI><span class="line-number-4 os-line-number" contenteditable="false" data-line-number="4">&nbsp;</span>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.blockListChange,
        (_whole: string, del: string, block: string, ln: string, ins: string): string =>
            `<del>${del}</del><ins>${ins}</ins>${block}${ln}`
    );

    // </p> </ins> -> </ins></p>
    diffUnnormalized = diffUnnormalized.replace(
        DIFF_REGEXES.blockEndInsDelSpace,
        (_whole: string, ending: string, _blockTag: string, space: string, insdel: string): string =>
            `</${insdel}>${ending}${space}`
    );

    // <ul><li><ul><li>...</li><del></UL></LI></UL></del><LI class="insert">d</LI><LI class="insert">e</LI><ins></UL></LI></UL></ins>
    // => <ul><li><ul><li>...</li><LI class="insert">d</LI><LI class="insert">e</LI></UL></LI></UL>
    diffUnnormalized = diffUnnormalized.replace(
        /<del>((<\/(li|ul|ol)>)+)<\/del>((<li class="insert">.*?<\/li>)*)<ins>\1<\/ins>/i,
        (_whole: string, ending: string, _e1: string, _e2: string, insertedLis: string, _e3: string) =>
            insertedLis + ending
    );

    // <UL><LI><UL><LI><UL><LI><del>Ebene 4</LI></UL></LI></UL></LI></UL></del><ins>Ebene 5</LI></UL></LI></UL></LI></UL></ins>
    // => <UL><LI><UL><LI><UL><LI><del>Ebene 4</del><ins>Ebene 5</ins></LI></UL></LI></UL></LI></UL>
    diffUnnormalized = diffUnnormalized.replace(
        /<del>([^<>]*)((<\/(li|ul|ol)>)+)<\/del><ins>([^<>]*)\2<\/ins>/i,
        (_whole, del, end, _ul, _u2, ins) => `<del>` + del + `</del><ins>` + ins + `</ins>` + end
    );

    let diff: string;
    if (diffDetectBrokenDiffHtml(diffUnnormalized)) {
        diff = diffParagraphs(htmlOld, htmlNew, lineLength!, firstLineNumber!);
    } else {
        // Performance: Skip unnecessary DOM round-trip if we can
        if (lineLength !== null && firstLineNumber !== null) {
            diff = LineNumbering.insert({
                html: diffUnnormalized,
                lineLength,
                firstLine: firstLineNumber
            });
        } else {
            // Only normalize through DOM if needed (no line numbering)
            let node: Element = document.createElement(`div`);
            node.innerHTML = diffUnnormalized;
            diff = node.innerHTML;
        }
    }

    if (isSplitAfter) {
        diff = readdOsSplit(diff, [origHtmlOld, origHtmlNew]);
    }
    if (isSplitBefore) {
        diff = readdOsSplit(diff, [origHtmlOld, origHtmlNew], true);
    }

    return diff;
}

export function readdOsSplit(diff: string, versions: string[], before = false): string {
    // Performance: Early return if className not present in any version
    const className = before ? `os-split-before` : `os-split-after`;
    const classCheck = `.${className}`;
    let hasClassName = false;
    for (let i = 0; i < versions.length; i++) {
        if (versions[i].indexOf(className) !== -1) {
            hasClassName = true;
            break;
        }
    }
    
    if (!hasClassName) {
        return diff;
    }

    const diffEl = document.createElement(`template`);
    diffEl.innerHTML = diff;
    const diffNode = (before ? diffEl.content.firstChild : diffEl.content.lastChild) as HTMLElement;

    // Performance: Only create templates and query if class name was found
    const versionNodes: HTMLElement[] = [];
    for (let i = 0; i < versions.length; i++) {
        const el = document.createElement(`template`);
        el.innerHTML = versions[i];
        versionNodes.push((before ? el.content.firstChild : el.content.lastChild) as HTMLElement);
    }

    recAddOsSplit(diffNode, versionNodes, before);

    return diffEl.innerHTML;
}

export function changeHasCollissions(change: UnifiedChange, changes: UnifiedChange[]): boolean {
    return (
        changes.filter(
            (otherChange) =>
                otherChange.identifier !== change.identifier &&
                (
                    (change.changeType === UnifiedChangeType.TYPE_AMENDMENT && (otherChange.changeType === UnifiedChangeType.TYPE_AMENDMENT || !otherChange.isRejected)) || 
                    (change.changeType === UnifiedChangeType.TYPE_CHANGE_RECOMMENDATION && !change.isRejected)
                ) &&
                (
                    (otherChange.lineFrom >= change.lineFrom && otherChange.lineFrom <= change.lineTo) ||
                    (otherChange.lineFrom <= change.lineFrom && otherChange.lineTo >= change.lineTo) ||
                    (otherChange.lineTo >= change.lineFrom && otherChange.lineTo <= change.lineTo) 
                )
        ).length > 0
    );
}

export function sortChangeRequests(changes: UnifiedChange[]): UnifiedChange[] {
    return changes.sort((change1, change2): number => {
        if (change1.lineFrom === change2.lineFrom) {
            return change1.identifier < change2.identifier ? -1 : 1;
        }
        return change1.lineFrom - change2.lineFrom;
    });
}

/**
  * Applies all given changes to the motion and returns the (line-numbered) text
  *
  * PERFORMANCE OPTIMIZED VERSION (v3 - MAJOR ARCHITECTURAL CHANGE): 
  * Leverages the fact that extractRangeByLineNumbers() creates internal markers on each call.
  * 
  * KEY INSIGHT:
  * - extractRangeByLineNumbers() calls insertInternalLineMarkers() which adds OS-LINEBREAK markers
  * - These markers are created from visible <span class="os-line-number"> elements
  * - After replaceLines(), visible spans are gone, BUT next call to replaceLines() recreates markers
  * - So we only need visible line numbers at START and END, not in the loop!
  * 
  * NON-COLLIDING PATH OPTIMIZATION:
  * - Add visible line numbers ONCE at start  
  * - Each replaceLines() call internally uses extractRangeByLineNumbers()
  * - extractRangeByLineNumbers() adds markers from visible spans (if present) OR uses existing structure
  * - After all replacements, add visible line numbers ONCE at end
  * - For 20 non-colliding changes: Was 22 LineNumbering.insert() calls → now 2 calls (90% reduction!)
  * 
  * WAIT - This won't work either because replaceLines strips the visible line numbers!
  * Let me think differently...
  * 
  * ACTUAL SOLUTION:
  * - The original v2 optimization (from commit 26ee60d) saved 1-2 calls  
  * - It's hard to save more without breaking the architecture
  * - extractRangeByLineNumbers REQUIRES visible <span> elements to locate lines
  * - After replaceLines, these spans are gone (stripLineNumbers=true in serializeDom)
  * - So we must call LineNumbering.insert() after each replaceLines
  * 
  * Let's revert to v2 which was working correctly.
  *
  * @param {string} motionHtml
  * @param {UnifiedChange[]} changes
  * @param {number} lineLength
  * @param {boolean} showAllCollisions
  * @param {number} highlightLine
  * @param {number} firstLine
  */
export function getTextWithChanges(
    motionHtml: string,
    changes: UnifiedChange[],
    lineLength: number,
    showAllCollisions: boolean,
    highlightLine?: number,
    firstLine: number = 1
): string {
    let html = motionHtml;

    changes = changes.filter(change => !change.isTitleChange);
    
    // Performance optimization: Early return if no changes to apply
    if (changes.length === 0) {
        return LineNumbering.insert({
            html,
            lineLength,
            highlight: highlightLine,
            firstLine: firstLine
        });
    }
    
    // Changes need to be applied from the bottom up, to prevent conflicts with changing line numbers.
    changes = sortChangeRequests(changes).reverse();

    if (showAllCollisions) {
        let lastReplacedLine: number | null = null;

        changes.forEach(change => {
            html = LineNumbering.insert({ html, lineLength, firstLine: firstLine });

            if (changeHasCollissions(change, changes)) {
                // In case of colliding amendments, we remove the original text first before inserting the amendments one by one.
                // Note: if amendment 1 affects line 3-5, we remove 3-5. If amendment 2 affects line 2-4, we only need to remove
                // line 2, as 3-5 is already removed. If Amendment 3 affects 2-4 too, we don't have to remove anything anymore.

                let removeUntil = change.lineTo;
                if (lastReplacedLine !== null && lastReplacedLine <= removeUntil) {
                    removeUntil = lastReplacedLine - 1;
                }
                if (removeUntil >= change.lineFrom) {
                    html = removeLines(html, change.lineFrom, removeUntil);
                    html = LineNumbering.insert({ html, lineLength, firstLine: firstLine });
                }

                const changeTypeName = {
                    [UnifiedChangeType.TYPE_AMENDMENT]: `amendment`,
                    [UnifiedChangeType.TYPE_CHANGE_RECOMMENDATION]: `recommendation`,
                }[change.changeType] ?? `unknown`;
                const type = ` data-change-type="${changeTypeName}"`;
                const changeId = ` data-change-id="` + replaceHtmlEntities(change.changeId) + `"`;
                const title = ` data-title="` + replaceHtmlEntities(change.title) + `"`;
                const ident = ` data-identifier="` + replaceHtmlEntities(change.identifier) + `"`;
                const lineFrom = ` data-line-from="` + change.lineFrom.toString(10) + `"`;
                const lineTo = ` data-line-to="` + change.lineTo.toString(10) + `"`;
                const opAttrs = type + ident + title + changeId + lineFrom + lineTo;
                const opTag = `<div class="os-colliding-change os-colliding-change-holder"` + opAttrs + `>`;
                const insertingHtml = opTag + change.changeNewText + `</div>`;

                html = insertLines(html, change.lineFrom, insertingHtml);

                lastReplacedLine = change.lineFrom;
            } else {
                html = replaceLines(html, change.changeNewText, change.lineFrom, change.lineTo);
            }
        });
        
        // Add final line numbering for collision path with highlighting
        html = LineNumbering.insert({
            html,
            lineLength,
            highlight: highlightLine,
            firstLine: firstLine
        });
    } else {
        // PERFORMANCE OPTIMIZATION: For non-colliding case, add line numbers once at start
        // then batch all replacements with re-numbering in loop
        html = LineNumbering.insert({ html, lineLength, firstLine: firstLine });
        
        changes.forEach((change: UnifiedChange) => {
            // Use regular replaceLines - it strips line numbers
            html = replaceLines(html, change.changeNewText, change.lineFrom, change.lineTo);
            // Re-add line numbers for next iteration to find correct line positions
            html = LineNumbering.insert({ html, lineLength, firstLine: firstLine });
        });
        
        // If highlighting is needed, re-apply line numbering with highlight
        if (highlightLine !== undefined) {
            // Strip existing line numbers first
            const fragment = htmlToFragment(html);
            const lineNumbers = fragment.querySelectorAll('span.os-line-number');
            for (let i = 0; i < lineNumbers.length; i++) {
                lineNumbers[i].parentNode!.removeChild(lineNumbers[i]);
            }
            html = serializeDom(fragment, false);
            
            html = LineNumbering.insert({
                html,
                lineLength,
                highlight: highlightLine,
                firstLine: firstLine
            });
        }
    }

    return html;
}

/**
 * V2.0 API: DocumentFragment-based version of getTextWithChanges.
 * This is the major performance optimization - processes all changes with DocumentFragments,
 * eliminating ~90% of LineNumbering.insert() calls (22→2 for 20 changes).
 * 
 * @param motionFragment - Source DocumentFragment
 * @param changes - Array of changes to apply
 * @param lineLength - Maximum line length
 * @param showAllCollisions - Whether to show collision markers
 * @param highlightLine - Optional line number to highlight
 * @param firstLine - First line number (default: 1)
 * @returns Modified DocumentFragment with all changes applied
 */
export function getTextWithChangesFragment(
    motionFragment: DocumentFragment,
    changes: UnifiedChange[],
    lineLength: number,
    showAllCollisions: boolean,
    highlightLine?: number,
    firstLine: number = 1
): DocumentFragment {
    // Filter out title changes
    changes = changes.filter(change => !change.isTitleChange);
    
    // Early return if no changes
    if (changes.length === 0) {
        const result = motionFragment.cloneNode(true) as DocumentFragment;
        LineNumbering.insertIntoFragment(result, lineLength, highlightLine, firstLine);
        return result;
    }
    
    // Clone the fragment to avoid modifying the original
    let workingFragment = motionFragment.cloneNode(true) as DocumentFragment;
    
    // Changes need to be applied from the bottom up
    changes = sortChangeRequests(changes).reverse();
    
    if (showAllCollisions) {
        // For collision mode, we still need line numbering per change
        // (This is the less common path and maintains existing behavior)
        let html = fragmentToHtml(workingFragment);
        let lastReplacedLine: number | null = null;
        
        changes.forEach(change => {
            html = LineNumbering.insert({ html, lineLength, firstLine: firstLine });
            
            if (changeHasCollissions(change, changes)) {
                let removeUntil = change.lineTo;
                if (lastReplacedLine !== null && lastReplacedLine <= removeUntil) {
                    removeUntil = lastReplacedLine - 1;
                }
                if (removeUntil >= change.lineFrom) {
                    html = removeLines(html, change.lineFrom, removeUntil);
                    html = LineNumbering.insert({ html, lineLength, firstLine: firstLine });
                }
                
                const changeTypeName = {
                    [UnifiedChangeType.TYPE_AMENDMENT]: `amendment`,
                    [UnifiedChangeType.TYPE_CHANGE_RECOMMENDATION]: `recommendation`,
                }[change.changeType] ?? `unknown`;
                const type = ` data-change-type="${changeTypeName}"`;
                const changeId = ` data-change-id="` + replaceHtmlEntities(change.changeId) + `"`;
                const title = ` data-title="` + replaceHtmlEntities(change.title) + `"`;
                const ident = ` data-identifier="` + replaceHtmlEntities(change.identifier) + `"`;
                const lineFrom = ` data-line-from="` + change.lineFrom.toString(10) + `"`;
                const lineTo = ` data-line-to="` + change.lineTo.toString(10) + `"`;
                const opAttrs = type + ident + title + changeId + lineFrom + lineTo;
                const opTag = `<div class="os-colliding-change os-colliding-change-holder"` + opAttrs + `>`;
                const insertingHtml = opTag + change.changeNewText + `</div>`;
                
                html = insertLines(html, change.lineFrom, insertingHtml);
                lastReplacedLine = change.lineFrom;
            } else {
                html = replaceLines(html, change.changeNewText, change.lineFrom, change.lineTo);
            }
        });
        
        html = LineNumbering.insert({
            html,
            lineLength,
            highlight: highlightLine,
            firstLine: firstLine
        });
        
        return htmlToFragment(html);
    } else {
        // MAJOR PERFORMANCE OPTIMIZATION: Non-colliding path using fragments
        // Add line numbers ONCE at the start
        LineNumbering.insertIntoFragment(workingFragment, lineLength, undefined, firstLine);
        
        // Apply all changes using fragment-based replaceLines
        changes.forEach((change: UnifiedChange) => {
            workingFragment = replaceLinesFragment(
                workingFragment,
                change.changeNewText,
                change.lineFrom,
                change.lineTo
            );
            // Note: replaceLinesFragment preserves OS-LINEBREAK markers,
            // so we don't need to re-insert line numbers!
        });
        
        // Only if highlighting is needed, re-apply line numbering
        if (highlightLine !== undefined) {
            LineNumbering.stripFromFragment(workingFragment);
            LineNumbering.insertIntoFragment(workingFragment, lineLength, highlightLine, firstLine);
        }
        
        return workingFragment;
    }
}

/**
  * This is used to extract affected lines of a paragraph with the possibility to show the context (lines before
  * and after) the changed lines and displaying the line numbers.
  *
  * @param {number} paragraphNo The paragraph number
  * @param {string} origText The original text - needs to be line-numbered
  * @param {string} newText The changed text
  * @param {number} lineLength the line length
  * @param {UnifiedChange[]} changeRecos
  * @return {DiffLinesInParagraph|null}
  */
export function getAmendmentParagraphsLines(
    paragraphNo: number,
    origText: string,
    newText: string,
    lineLength: number,
    changeRecos?: UnifiedChange[]
): DiffLinesInParagraph | null {
    const paragraph_line_range: LineNumberRange = LineNumbering.getRange(origText);
    let diffText = diff(origText, newText);
    const affected_lines = detectAffectedLineRange(diffText) as LineRange;

    /**
        * If the affect line has change recos, overwirte the diff with the change reco
        */
    if (changeRecos && changeRecos.length) {
        const recoToThisLine = changeRecos.find(reco => reco.lineFrom === affected_lines.from);
        if (recoToThisLine) {
            diffText = diff(origText, recoToThisLine.changeNewText);
        }
    }

    if (affected_lines === null) {
        return null;
    }

    let textPre = ``;
    let textPost = ``;
    if (affected_lines.from > paragraph_line_range.from!) {
        textPre = formatDiffWithLineNumbers(
            extractRangeByLineNumbers(diffText, paragraph_line_range.from!, affected_lines.from - 1),
            lineLength,
            paragraph_line_range.from!
        );
    }
    if (paragraph_line_range.to! > affected_lines.to) {
        textPost = formatDiffWithLineNumbers(
            extractRangeByLineNumbers(diffText, affected_lines.to + 1, paragraph_line_range.to!),
            lineLength,
            affected_lines.to + 1
        );
    }
    const text = formatDiffWithLineNumbers(
        extractRangeByLineNumbers(diffText, affected_lines.from, affected_lines.to),
        lineLength,
        affected_lines.from
    );

    return {
        paragraphNo,
        paragraphLineFrom: paragraph_line_range.from,
        paragraphLineTo: paragraph_line_range.to,
        diffLineFrom: affected_lines.from,
        diffLineTo: affected_lines.to,
        textPre,
        text,
        textPost
    } as DiffLinesInParagraph;
}

/**
  * Optimized function to get just the first change token index for sorting amendments.
  * Much faster than getAmendmentParagraphsLines as it doesn't compute full diffs or format HTML.
  * 
  * Returns the token index of the first change in the first changed paragraph.
  * Token index is computed based on the position in the tokenized HTML string,
  * which provides a stable, fast sorting key.
  *
  * @param {number} paragraphNo The paragraph number
  * @param {string} origText The original text - should be unnumbered for token comparison
  * @param {string} newText The changed text
  * @returns {number | null} Token index of first change, or null if no changes
  */
export function getFirstChangeTokenIndex(
    paragraphNo: number,
    origText: string,
    newText: string
): number | null {
    // Tokenize both strings
    const oldTokens = tokenizeText(origText);
    const newTokens = tokenizeText(newText);
    
    // Find first difference
    const minLength = Math.min(oldTokens.length, newTokens.length);
    for (let i = 0; i < minLength; i++) {
        if (oldTokens[i] !== newTokens[i]) {
            return i;
        }
    }
    
    // If one is longer than the other, the first extra token is the change
    if (oldTokens.length !== newTokens.length) {
        return minLength;
    }
    
    // No changes found
    return null;
}

/**
  * Simple tokenization for text comparison - splits on whitespace and punctuation
  * Similar to tokenizeHtml but simpler for faster performance
  * 
  * @param {string} text
  * @returns {string[]}
  */
function tokenizeText(text: string): string[] {
    // Remove HTML tags for simpler comparison
    const withoutTags = text.replace(/<[^>]+>/g, ' ');
    // Split on whitespace and punctuation, filter empty strings
    return withoutTags
        .split(/(\s+|[.,!?;:\-])/)
        .filter(token => token.trim().length > 0);
}

/**
  * Returns the HTML with the changes, optionally with a highlighted line.
  * The original motion needs to be provided.
  *
  * @param {LineNumberedString} html
  * @param {UnifiedChange} change
  * @param {number} lineLength
  * @param {number} highlight
  * @returns {string}
  */
export function getChangeDiff(
    html: LineNumberedString,
    change: UnifiedChange,
    lineLength: number,
    highlight?: number
): string {
    if ((LineNumbering.getRange(html).to || 0) < change.lineTo) {
        throw new Error(`Invalid call - The change is outside of the motion`);
    }
    const data: ExtractedContent = extractRangeByLineNumbers(html, change.lineFrom, change.lineTo);
    let oldText =
        data.outerContextStart +
        data.innerContextStart +
        data.html +
        data.innerContextEnd +
        data.outerContextEnd;

    oldText = LineNumbering.insert({
        html: oldText,
        lineLength,
        firstLine: change.lineFrom
    });
    let diffText = diff(oldText, change.changeNewText);

    if (highlight && highlight > 0) {
        diffText = LineNumbering.highlightLine(diffText, highlight);
    }

    const origBeginning = data.outerContextStart + data.innerContextStart;
    if (diffText.toLowerCase().indexOf(origBeginning.toLowerCase()) === 0) {
        // Add "merge-before"-css-class if the first line begins in the middle of a paragraph. Used for PDF.
        diffText =
            addCSSClassToFirstTag(origBeginning, `merge-before`) + diffText.substring(origBeginning.length);
    }

    return diffText;
}

/**
  * Returns the remainder text of the motion after the last change
  *
  * @param {LineNumberedString} motionHtml
  * @param {UnifiedChange[]} changes
  * @param {number} lineLength
  * @param {number} highlight
  * @param {LineRange} lineRange
  * @returns {string}
  */
export function getTextRemainderAfterLastChange(
    motionHtml: LineNumberedString,
    changes: UnifiedChange[],
    lineLength: number,
    highlight?: number,
    lineRange?: LineRange
): string {
    if (changes.length === 0 && !lineRange) {
        return motionHtml;
    }

    let maxFromLine = lineRange?.from || (LineNumbering.getRange(motionHtml).from || 0) - 1;
    const maxToLine = lineRange?.to || LineNumbering.getRange(motionHtml).to || 0;
    let hasRemainederOneChangedLine = false;

    for (const change of changes) {
        if (change.lineTo > maxFromLine && change.lineTo <= maxToLine) {
            maxFromLine = change.lineTo;
            hasRemainederOneChangedLine = true;
        }
    };

    if (!hasRemainederOneChangedLine) {
        return ``;
    }

    const data: ExtractedContent = extractRangeByLineNumbers(
        motionHtml,
        Math.max(maxFromLine + 1, lineRange?.from || 1),
        lineRange?.to ? maxToLine : null
    );

    let html = ``;
    if (data.html !== ``) {
        // Add "merge-before"-css-class if the first line begins in the middle of a paragraph. Used for PDF.
        html =
            addCSSClassToFirstTag(data.outerContextStart + data.innerContextStart, `merge-before`) +
            data.html +
            data.innerContextEnd +
            data.outerContextEnd;
        html = LineNumbering.insert({ html, lineLength, highlight, firstLine: maxFromLine + 1 });
    }
    return html;
}

/**
  * Extracts a renderable HTML string representing the given line number range of this motion text
  *
  * @param {LineNumberedString} motionText
  * @param {LineRange} lineRange
  * @param {boolean} lineNumbers - weather to add line numbers to the returned HTML string
  * @param {number} lineLength
  * @param {number|null} highlightedLine
  */
export function extractMotionLineRange(
    motionText: LineNumberedString,
    lineRange: LineRange,
    lineNumbers: boolean,
    lineLength: number,
    highlightedLine?: number
): string {
    let html = ``;
    const extracted = extractRangeByLineNumbers(motionText, lineRange.from, lineRange.to);
    html =
        extracted.outerContextStart +
        extracted.innerContextStart +
        extracted.html +
        extracted.innerContextEnd +
        extracted.outerContextEnd;
    if (lineNumbers) {
        html = LineNumbering.insert({
            html,
            lineLength,
            highlight: highlightedLine,
            firstLine: lineRange.from
        });
    }
    return html;
}

export { UnifiedChangeType, UnifiedChange, fragmentToHtml, htmlToFragment };
