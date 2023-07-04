import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { NgxMaterialTimepickerModule } from 'ngx-material-timepicker';
import { OpenSlidesTranslationModule } from 'src/app/site/modules/translations';

import { OpenSlidesDateAdapterModule } from '../openslides-date-adapter/openslides-date-adapter.module';
import { DatetimepickerComponent } from './components/datetimepicker/datetimepicker.component';

@NgModule({
    declarations: [DatetimepickerComponent],
    imports: [
        CommonModule,
        MatDatepickerModule,
        NgxMaterialTimepickerModule,
        ReactiveFormsModule,
        MatInputModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        OpenSlidesDateAdapterModule,
        OpenSlidesTranslationModule.forChild()
    ],
    exports: [DatetimepickerComponent]
})
export class DatetimepickerModule {}
