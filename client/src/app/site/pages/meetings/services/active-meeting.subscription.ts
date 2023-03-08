import { map, Observable } from 'rxjs';
import { Id } from 'src/app/domain/definitions/key-types';
import { DEFAULT_FIELDSET } from 'src/app/site/services/model-request-builder';

import { ViewPoll } from '../pages/polls';
import { ViewMeeting } from '../view-models/view-meeting';

export const ACTIVE_MEETING_SUBSCRIPTION = `active_meeting`;

export const getActiveMeetingSubscriptionConfig = (
    id: Id,
    getNextMeetingIdObservable: () => Observable<Id | null>
) => ({
    modelRequest: {
        viewModelCtor: ViewMeeting,
        ids: [id],
        fieldset: DEFAULT_FIELDSET,
        follow: [
            `chat_group_ids`,
            `chat_message_ids`,
            {
                idField: `poll_ids`,
                follow: [{ idField: `content_object_id`, fieldset: [`title`] }],
                fieldset: [`title`, `state`, `entitled_group_ids`]
            },
            `group_ids`,
            { idField: `committee_id`, additionalFields: [`name`] }
        ],
        additionalFields: [`jitsi_domain`, `jitsi_room_name`, `jitsi_room_password`]
    },
    subscriptionName: ACTIVE_MEETING_SUBSCRIPTION,
    hideWhen: getNextMeetingIdObservable().pipe(map(id => !id))
});
