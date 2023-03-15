import { Component } from '@angular/core';
import {
    BaseModelRequestHandlerComponent,
    ModelRequestConfig
} from 'src/app/site/base/base-model-request-handler.component/base-model-request-handler.component';

import { getDashboardMeetingListSubscriptionConfig } from '../../../../dashboard.subscription';

@Component({
    selector: `os-dashboard-main`,
    templateUrl: `./dashboard-main.component.html`,
    styleUrls: [`./dashboard-main.component.scss`]
})
export class DashboardMainComponent extends BaseModelRequestHandlerComponent {
    protected override onCreateModelRequests(): void | ModelRequestConfig[] {
        return [getDashboardMeetingListSubscriptionConfig(() => this.getNextMeetingIdObservable())];
    }
}
