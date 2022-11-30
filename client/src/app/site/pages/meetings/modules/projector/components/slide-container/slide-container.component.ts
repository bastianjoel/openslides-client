import { Component, ComponentRef, Input, ViewChild, ViewContainerRef } from '@angular/core';
import { ViewProjector } from 'src/app/site/pages/meetings/pages/projectors';

import { SlideData } from '../../../../pages/projectors/definitions';
import { isBaseScaleScrollSlideComponent } from '../../modules/slides/base/base-scale-scroll-slide-component';
import { BaseSlideComponent } from '../../modules/slides/base/base-slide-component';
import { SlideManagerService } from '../../modules/slides/services/slide-manager.service';

function hasError(obj: object): obj is { error: string } {
    return (<{ error: string }>obj)?.error !== undefined;
}

@Component({
    selector: `os-slide-container`,
    templateUrl: `./slide-container.component.html`,
    styleUrls: [`./slide-container.component.scss`]
})
export class SlideContainerComponent {
    public slideTwoActive: boolean = false;

    private previousSlideName: string | undefined;

    @ViewChild(`slideOne`, { read: ViewContainerRef, static: true })
    private slideOne: ViewContainerRef | null = null;

    @ViewChild(`slideTwo`, { read: ViewContainerRef, static: true })
    private slideTwo: ViewContainerRef | null = null;

    private get slides() {
        return [this.slideOne, this.slideTwo];
    }

    private get slide() {
        return this.slides[+this.slideTwoActive];
    }

    private slideRefs: ComponentRef<BaseSlideComponent<object>>[] = [];

    /**
     * A slide is autonomic, if it takes care of scaling and scrolling by itself.
     */
    private get slideIsAutonomic(): boolean[] {
        return [
            !!this.slideRefs[0] &&
                !!this.slideRefs[0].instance &&
                isBaseScaleScrollSlideComponent(this.slideRefs[0].instance),
            !!this.slideRefs[1] &&
                !!this.slideRefs[1].instance &&
                isBaseScaleScrollSlideComponent(this.slideRefs[1].instance)
        ];
    }

    /**
     * The data for this slide. Will be accessed below.
     */
    private _slideData!: SlideData<object>;

    @Input()
    public set slideData(slideData: SlideData<object>) {
        // If there is no data or an error, clear and exit.
        if (!slideData || !slideData.data || hasError(slideData) || hasError(slideData?.data)) {
            // clear slide container:
            if (this.slide) {
                this.slide.clear();
            }

            let error: string | null = null;
            if (hasError(slideData)) {
                error = slideData.error;
            } else if (hasError(slideData?.data)) {
                error = slideData.data.error;
            }

            if (error) {
                console.error(`slide error: `, error, `\nSlide was: `, slideData);
            }
            return;
        }

        this._slideData = slideData;
        const slideName = slideData.type || slideData.collection;
        if (this.previousSlideName !== slideName) {
            this.slideChanged(slideName);
            this.previousSlideName = slideName;
        } else {
            this.setDataForComponent();
        }
    }

    public get slideData(): SlideData<object> {
        return this._slideData;
    }

    private _projector!: ViewProjector;

    /**
     * Variable, if the projector header is enabled.
     */
    @Input()
    public set projector(projector: ViewProjector) {
        this._projector = projector;
        this.setProjectorForComponent();
        this.updateScroll();
        this.updateScale();
    }

    public get projector(): ViewProjector {
        return this._projector;
    }

    // TODO: scale and scroll can be taken from the projector setter/getter
    // TODO: Add a prev_scroll/prev_scale to only update on changes.

    /**
     * The current projector scroll.
     */
    private _scroll!: number;

    /**
     * Updates the slideStyle, when the scroll changes.
     */
    @Input()
    public set scroll(value: number) {
        this._scroll = value;
        this.updateScroll();
    }

    public get scroll(): number {
        return this._scroll;
    }

    private _scale!: number;

    /**
     * Update the slideStyle, when the scale changes.
     */
    @Input()
    public set scale(value: number) {
        this._scale = value;
        this.updateScale();
    }

    public get scale(): number {
        return this._scale;
    }

    /**
     * The current slideoptions.
     */
    public slideOptions: { scaleable: boolean; scrollable: boolean }[] = [
        { scaleable: false, scrollable: false },
        { scaleable: false, scrollable: false }
    ];

    /**
     * Styles for scaling and scrolling.
     */
    public slideStyle: { 'font-size': string; 'margin-top': string }[] = [
        {
            'font-size': `100%`,
            'margin-top': `50px`
        },
        {
            'font-size': `100%`,
            'margin-top': `50px`
        }
    ];

    public constructor(private slideManager: SlideManagerService) {}

    /**
     * Updates the 'margin-top' attribute in the slide styles. Propages the sroll to
     * autonomic slides.
     */
    private updateScroll(slide?: number): void {
        if (slide === undefined) {
            slide = +this.slideTwoActive;
        }

        if (this.slideOptions[slide].scrollable && !this.slideIsAutonomic[slide]) {
            let value = this.scroll;
            value *= -100;
            if (this.projector && this.projector.show_header_footer) {
                value += 50; // Default offset for the header
            }
            this.slideStyle[slide][`margin-top`] = `${value}px`;
        } else {
            this.slideStyle[slide][`margin-top`] = `0px`;

            const ref = this.slideRefs[slide];
            if (this.slideIsAutonomic[slide] && isBaseScaleScrollSlideComponent(ref.instance)) {
                ref.instance.scroll = this.scroll;
            }
        }
    }

    /**
     * Updates the 'font-size' style attributes. Propagates the scale to autonomic slides.
     */
    private updateScale(slide?: number): void {
        if (slide === undefined) {
            slide = +this.slideTwoActive;
        }

        if (this.slideOptions[slide].scaleable && !this.slideIsAutonomic[slide]) {
            let scale = this.scale;
            scale *= 10;
            scale += 100;
            this.slideStyle[slide][`font-size`] = `${scale}%`;
        } else {
            this.slideStyle[slide][`font-size`] = `100%`;

            const ref = this.slideRefs[slide];
            if (this.slideIsAutonomic[slide] && isBaseScaleScrollSlideComponent(ref.instance)) {
                ref.instance.scale = this.scale;
            }
        }
    }

    /**
     * Loads the slides via the SlideManager. Creates the slide components and provide the slide data to it.
     *
     * @param slideName The slide to load.
     */
    private slideChanged(slideName: string): void {
        const options = this.slideManager.getSlideConfiguration(slideName);
        const nextSlide = +!this.slideTwoActive;
        this.slideOptions[nextSlide].scaleable = options.scaleable;
        this.slideOptions[nextSlide].scrollable = options.scrollable;
        this.slideManager.getSlideType(slideName).then(type => {
            this.slideRefs[nextSlide] = this.slides[nextSlide].createComponent(type);
            this.setDataForComponent(nextSlide);
            this.setProjectorForComponent(nextSlide);
            this.updateScroll(nextSlide);
            this.updateScale(nextSlide);
            this.slideTwoActive = !this.slideTwoActive;
            this.slides[+!this.slideTwoActive].clear();
        });
    }

    /**
     * "injects" the slide data into the slide component.
     */
    private setDataForComponent(slide?: number): void {
        if (slide === undefined) {
            slide = +this.slideTwoActive;
        }

        if (this.slideRefs[slide] && this.slideRefs[slide].instance) {
            this.slideRefs[slide].instance.data = this.slideData;
            this.slideRefs[slide].changeDetectorRef.detectChanges();
        }
    }

    /**
     * "injects" the projector into the slide component.
     */
    private setProjectorForComponent(slide?: number): void {
        if (slide === undefined) {
            slide = +this.slideTwoActive;
        }

        if (this.slideRefs[slide] && this.slideRefs[slide].instance) {
            this.slideRefs[slide].instance.projector = this.projector;
        }
    }
}
