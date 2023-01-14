import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyMenuModule as MatMenuModule } from '@angular/material/legacy-menu';
import { OpenSlidesTranslationModule } from 'src/app/site/modules/translations';
import { HeadBarModule } from 'src/app/ui/modules/head-bar';
import { IconContainerModule } from 'src/app/ui/modules/icon-container';
import { SearchSelectorModule } from 'src/app/ui/modules/search-selector';
import { SortingModule } from 'src/app/ui/modules/sorting';
import { PipesModule } from 'src/app/ui/pipes';

import { CommentsRoutingModule } from './comments-routing.module';
import { CommentSectionListComponent } from './components/comment-section-list/comment-section-list.component';
import { CommentSectionSortComponent } from './components/comment-section-sort/comment-section-sort.component';

@NgModule({
    declarations: [CommentSectionListComponent, CommentSectionSortComponent],
    imports: [
        CommonModule,
        CommentsRoutingModule,
        SortingModule,
        HeadBarModule,
        SearchSelectorModule,
        IconContainerModule,
        PipesModule,
        OpenSlidesTranslationModule.forChild(),
        MatCardModule,
        MatExpansionModule,
        MatIconModule,
        MatMenuModule,
        MatFormFieldModule,
        MatDialogModule,
        MatInputModule,
        MatCheckboxModule,
        ReactiveFormsModule
    ]
})
export class CommentsModule {}
