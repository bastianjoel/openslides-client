import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ViewProjector } from 'src/app/site/pages/meetings/pages/projectors';
import { AuthTokenService } from 'src/app/site/services/auth-token.service';
import { BaseUiComponent } from 'src/app/ui/base/base-ui-component';
import { DirectivesModule } from 'src/app/ui/directives';
import { PipesModule } from 'src/app/ui/pipes';

import { Dimension } from '../../../../pages/projectors/definitions';

@Component({
    standalone: true,
    imports: [CommonModule, DirectivesModule, PipesModule],
    selector: `os-projector`,
    templateUrl: `./projector.component.html`,
    styleUrls: [`./projector.component.scss`]
})
export class ProjectorComponent extends BaseUiComponent implements OnInit, OnDestroy {
    private readonly projectorSubject = new BehaviorSubject<ViewProjector | null>(null);

    @Input()
    public set projector(projector: ViewProjector | null) {
        this.projectorSubject.next(projector);
    }

    public get projector(): ViewProjector | null {
        return this.projectorSubject.getValue();
    }

    public get url(): string {
        return `/system/projector/get/${this.projector.id}`;
    }

    /**
     * The current projector size. This is for checking,
     * if the size actually has changed.
     */
    private currentProjectorSize: Dimension = { width: 0, height: 0 };

    /**
     * The container element. THis is neede to get the size of the element,
     * in which the projector must fit and be scaled to.
     */
    @ViewChild(`container`, { static: true })
    private containerElement: ElementRef | null = null;

    /**
     * The container element. THis is neede to get the size of the element,
     * in which the projector must fit and be scaled to.
     */
    @ViewChild(`projector`, { static: true })
    private projectorElement: ElementRef | null = null;

    public containerHeight = `0px`;

    private destroyProjector: () => void;

    public constructor(private authTokenService: AuthTokenService) {
        super();

        this.subscriptions.push(
            this.projectorSubject.subscribe(projector => {
                if (!projector) {
                    return;
                }

                const oldSize: Dimension = { ...this.currentProjectorSize };
                this.currentProjectorSize.height = projector.height;
                this.currentProjectorSize.width = projector.width;
                if (
                    oldSize.height !== this.currentProjectorSize.height ||
                    oldSize.width !== this.currentProjectorSize.width
                ) {
                    this.updateScaling();
                }
            })
        );
    }

    public ngOnInit(): void {
        const projectorScript = `/system/projector/static/projector.js`;
        import(projectorScript).then(M => {
            this.destroyProjector = M.Projector(
                this.projectorElement.nativeElement,
                this.projector.id,
                () => this.authTokenService.rawAccessToken
            );
        });
    }

    public onResized(): void {
        if (this.containerElement) {
            this.updateScaling();
        }
    }

    /**
     * Scales the projector to the right format.
     */
    private updateScaling(): void {
        if (
            !this.containerElement ||
            this.currentProjectorSize.width === 0 ||
            this.containerElement.nativeElement.offsetWidth === 0
        ) {
            return;
        }
        const scale = this.containerElement.nativeElement.offsetWidth / this.currentProjectorSize.width;
        if (isNaN(scale)) {
            return;
        }
        this.containerHeight = Math.round(scale * this.currentProjectorSize.height) + `px`;
        this.projectorElement.nativeElement.dispatchEvent(new Event(`resize`));
    }

    public override ngOnDestroy(): void {
        super.ngOnDestroy();

        if (this.destroyProjector) {
            this.destroyProjector();
        }
    }
}
