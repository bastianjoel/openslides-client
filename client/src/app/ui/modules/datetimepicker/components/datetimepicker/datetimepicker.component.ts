import { FocusMonitor } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, ElementRef, Optional, Self, ViewEncapsulation } from '@angular/core';
import { NgControl, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { MatFormFieldControl } from '@angular/material/form-field';
import { format, getUnixTime, parse } from 'date-fns';

import { BaseDatetimepickerComponent } from '../base-datetimepicker/base-datetimepicker.component';

@Component({
    selector: `os-datetimepicker`,
    templateUrl: `./datetimepicker.component.html`,
    styleUrls: [`./datetimepicker.component.scss`],
    providers: [{ provide: MatFormFieldControl, useExisting: DatetimepickerComponent }],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DatetimepickerComponent extends BaseDatetimepickerComponent {
    public get empty(): boolean {
        return !(this.value[`start`] || this.value[`end`]);
    }

    public pickerFormGroup: UntypedFormGroup;
    public override contentForm: UntypedFormControl;

    constructor(
        formBuilder: UntypedFormBuilder,
        focusMonitor: FocusMonitor,
        element: ElementRef<HTMLElement>,
        @Optional() @Self() ngControl: NgControl
    ) {
        super(formBuilder, focusMonitor, element, ngControl);

        this.pickerFormGroup = formBuilder.group({
            datepicker: [],
            timepicker: []
        });

        this.pickerFormGroup.valueChanges.subscribe(v => {
            this.contentForm.setValue(format(v.datepicker, `yyyy-MM-dd`) + `T` + (v.timepicker || `00:00`));
        });
    }

    protected createForm(): UntypedFormControl {
        return this.fb.control(null);
    }

    protected updateForm(value: any | null): void {
        if (typeof value === `number`) {
            value = format(value * 1000, `yyyy-MM-dd'T'HH:mm`);
        }

        const date = parse(value, `yyyy-MM-dd'T'HH:mm`, 0);
        this.pickerFormGroup.setValue({
            datepicker: date,
            timepicker: format(date, `HH:mm`)
        });
        this.contentForm.setValue(value);
    }

    protected override push(value: any | null): void {
        value = value ? getUnixTime(parse(value, `yyyy-MM-dd'T'HH:mm`, 0)) : value;
        this._onChange(value);
        this._onTouched(value);
    }
}
