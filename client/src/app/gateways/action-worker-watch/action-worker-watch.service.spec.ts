import { HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Id } from 'src/app/domain/definitions/key-types';
import { ActionWorker } from 'src/app/domain/models/action-worker/action-worker';
import { WaitForActionData, WaitForActionReason } from 'src/app/site/modules/wait-for-action-dialog/definitions';
import { WaitForActionDialogService } from 'src/app/site/modules/wait-for-action-dialog/services';
import { ModelRequestService } from 'src/app/site/services/model-request.service';
import { BaseRepoServiceMock } from 'tests/mock/base-repo-service.mock';
import { ModelRequestServiceMock } from 'tests/mock/model-request-service.mock';

import { ActionWorkerRepositoryService } from '../repositories/action-worker/action-worker-repository.service';
import { ActionWorkerWatchService } from './action-worker-watch.service';

class WaitForActionDialogServiceMock {
    public removeAllDates(workerId: Id): void {}
    public async openClosingPrompt(snapshot: Partial<ActionWorker> & { closed: number }): Promise<void> {}
    public addNewDialog(reason: WaitForActionReason, data: WaitForActionData): void {}
}

function getWatchResponse(): HttpResponse<unknown> {
    return new HttpResponse({
        body: {
            results: [
                [
                    {
                        name: `test`,
                        fqid: `action/1`
                    }
                ]
            ]
        }
    });
}

describe(`BackendThreadWatcherService`, () => {
    let service: ActionWorkerWatchService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                { provide: ModelRequestService, useClass: ModelRequestServiceMock },
                { provide: ActionWorkerRepositoryService, useClass: BaseRepoServiceMock },
                { provide: WaitForActionDialogService, useClass: WaitForActionDialogServiceMock }
            ]
        });
        service = TestBed.inject(ActionWorkerWatchService);
    });

    it(`should be created`, () => {
        expect(service).toBeTruthy();
    });

    it(``, () => {
        service.watch(getWatchResponse(), true);
        service.watch(getWatchResponse(), false);
    });
});
