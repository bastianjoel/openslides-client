import { FocusMonitor } from '@angular/cdk/a11y';
import { Directive, ElementRef, Input, Optional, Self, ViewChild } from '@angular/core';
import { NgControl, UntypedFormBuilder } from '@angular/forms';
import { MatDatepicker } from '@angular/material/datepicker';
import { NgxTimepickerFieldComponent } from 'ngx-material-timepicker';
import { distinctUntilChanged, map } from 'rxjs';
import { BaseFormFieldControlComponent } from 'src/app/ui/base/base-form-field-control';

@Directive()
export abstract class BaseDatetimepickerComponent extends BaseFormFieldControlComponent<any> {
    @ViewChild(`datepicker`) datepicker: MatDatepicker<Date>;
    @ViewChild(`timepicker`) timepicker: NgxTimepickerFieldComponent;

    public readonly controlType = `os-datetimepicker`;

    /**
     * A possible error send by the server.
     */
    @Input()
    public error: string | null = null;

    @Input()
    public title: string | null = null;

    @Input()
    public hintText: string | null = null;

    @Input()
    public showUpdateSuccessIcon: boolean = false;

    constructor(
        formBuilder: UntypedFormBuilder,
        focusMonitor: FocusMonitor,
        element: ElementRef<HTMLElement>,
        @Optional() @Self() ngControl: NgControl
    ) {
        super(formBuilder, focusMonitor, element, ngControl);

        this.fm
            .monitor(element.nativeElement, true)
            .pipe(
                map(origin => !!origin),
                distinctUntilChanged()
            )
            .subscribe(focused => {
                if (focused) {
                    this.datepicker.open();
                }
            });
    }

    public onContainerClick(event: MouseEvent): void {}

    protected initializeForm(): void {}
}
