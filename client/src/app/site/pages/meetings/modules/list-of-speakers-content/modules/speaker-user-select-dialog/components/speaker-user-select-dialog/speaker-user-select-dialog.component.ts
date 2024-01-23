import { Component, Inject } from '@angular/core';
import {
    MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
    MatLegacyDialogRef as MatDialogRef
} from '@angular/material/legacy-dialog';
import { Id } from 'src/app/domain/definitions/key-types';
import { UserRepositoryService } from 'src/app/gateways/repositories/users';
import { ViewListOfSpeakers } from 'src/app/site/pages/meetings/pages/agenda';

import { UserSelectionData } from '../../../../../participant-search-selector';

interface SpeakerUserSelectDialogComponentData {
    listOfSpeakers: ViewListOfSpeakers;
    stopSpeechDialog?: boolean;
}

@Component({
    selector: `os-speaker-user-select-dialog`,
    templateUrl: `./speaker-user-select-dialog.component.html`,
    styleUrls: [`./speaker-user-select-dialog.component.scss`]
})
export class SpeakerUserSelectDialogComponent {
    public nonAvailableUserIds: Id[] = [];
    public stopSpeechDialog = false;

    public constructor(
        public readonly dialogRef: MatDialogRef<SpeakerUserSelectDialogComponent>,
        @Inject(MAT_DIALOG_DATA)
        public readonly data: SpeakerUserSelectDialogComponentData,
        public userRepo: UserRepositoryService
    ) {
        this.stopSpeechDialog = !!data.stopSpeechDialog;
    }

    public setCurrentUser(selection: UserSelectionData) {
        if (selection.userId) {
            const meeting_user_id = this.userRepo
                .getViewModel(selection.userId)
                .getMeetingUser(this.data.listOfSpeakers.meeting_id).id;
            this.dialogRef.close({ meeting_user_id });
        }
    }

    public onCancel(): void {
        this.dialogRef.close();
    }

    public onContinue(): void {
        this.dialogRef.close({ meeting_user_id: null });
    }
}
