import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyListModule as MatListModule } from '@angular/material/legacy-list';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';

import { OpenSlidesTranslationModule } from '../translations';
import { UserComponentsModule } from '../user-components';
import { AccountButtonComponent } from './components/account-button/account-button.component';
import { AccountDialogComponent } from './components/account-dialog/account-dialog.component';
import { GlobalHeadbarComponent } from './components/global-headbar/global-headbar.component';
import { GlobalSearchComponent } from './components/global-search/global-search.component';

const MODULES = [
    MatToolbarModule,
    MatIconModule,
    MatListModule,
    MatButtonModule,
    MatDividerModule,
    MatMenuModule,
    MatTooltipModule,
    MatDialogModule
];
const DECLARATIONS = [GlobalHeadbarComponent];

@NgModule({
    exports: DECLARATIONS,
    declarations: [...DECLARATIONS, AccountButtonComponent, AccountDialogComponent, GlobalSearchComponent],
    imports: [
        CommonModule,
        OpenSlidesTranslationModule.forChild(),
        UserComponentsModule,
        RouterModule,
        ScrollingModule,
        ...MODULES
    ]
})
export class GlobalHeadbarModule {}
