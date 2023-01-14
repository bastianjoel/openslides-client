import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatRippleModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyChipsModule as MatChipsModule } from '@angular/material/legacy-chips';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyTableModule as MatTableModule } from '@angular/material/legacy-table';
import { OpenSlidesTranslationModule } from 'src/app/site/modules/translations';
import { MeetingsComponentCollectorModule } from 'src/app/site/pages/meetings/modules/meetings-component-collector';
import { FileUploadModule } from 'src/app/ui/modules/file-upload';
import { HeadBarModule } from 'src/app/ui/modules/head-bar';
import { SortingListModule } from 'src/app/ui/modules/sorting/modules';

import { WorkflowDetailComponent } from './components/workflow-detail/workflow-detail.component';
import { WorkflowDetailSortComponent } from './components/workflow-detail-sort/workflow-detail-sort.component';
import { WorkflowImportComponent } from './components/workflow-import/workflow-import.component';
import { WorkflowListComponent } from './components/workflow-list/workflow-list.component';
import { MotionWorkflowServiceModule } from './services';
import { WorkflowsRoutingModule } from './workflows-routing.module';

@NgModule({
    declarations: [
        WorkflowListComponent,
        WorkflowDetailComponent,
        WorkflowImportComponent,
        WorkflowDetailSortComponent,
        WorkflowDetailSortComponent
    ],
    imports: [
        CommonModule,
        WorkflowsRoutingModule,
        MotionWorkflowServiceModule,
        MeetingsComponentCollectorModule,
        FileUploadModule,
        HeadBarModule,
        MatCardModule,
        OpenSlidesTranslationModule.forChild(),
        MatMenuModule,
        MatIconModule,
        MatFormFieldModule,
        MatDialogModule,
        MatDividerModule,
        MatTableModule,
        MatCheckboxModule,
        MatChipsModule,
        MatRippleModule,
        MatInputModule,
        FormsModule,
        SortingListModule
    ]
})
export class WorkflowsModule {}
