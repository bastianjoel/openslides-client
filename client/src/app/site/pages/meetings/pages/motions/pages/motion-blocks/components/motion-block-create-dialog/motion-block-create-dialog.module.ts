import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { OpenSlidesTranslationModule } from 'src/app/site/modules/translations';
import { AgendaContentObjectFormModule } from 'src/app/site/pages/meetings/modules/meetings-component-collector/agenda-content-object-form/agenda-content-object-form.module';

import { MotionBlockCreateDialogComponent } from './components/motion-block-create-dialog/motion-block-create-dialog.component';

@NgModule({
    declarations: [MotionBlockCreateDialogComponent],
    imports: [
        CommonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatCheckboxModule,
        MatButtonModule,
        ReactiveFormsModule,
        AgendaContentObjectFormModule,
        OpenSlidesTranslationModule.forChild()
    ]
})
export class MotionBlockCreateDialogModule {
    public static getComponent(): typeof MotionBlockCreateDialogComponent {
        return MotionBlockCreateDialogComponent;
    }
}
