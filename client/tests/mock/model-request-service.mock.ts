import { ModelData } from 'src/app/site/services/autoupdate/utils';
import { SubscribeToConfig } from 'src/app/site/services/model-request.service';

export class ModelRequestServiceMock {
    public async updateSubscribeTo(...configs: SubscribeToConfig[]): Promise<void> {}

    public async subscribeTo({ modelRequest, subscriptionName, ...config }: SubscribeToConfig): Promise<void> {}
    public async subscriptionGotData(subscriptionName: string): Promise<boolean | ModelData> {
        return null;
    }
    public async fetch({ modelRequest, subscriptionName }: SubscribeToConfig): Promise<ModelData> {
        return null;
    }
    public async waitSubscriptionReady(subscriptionName: string): Promise<void> {}
    public closeSubscription(subscriptionName: string): void {}
}
