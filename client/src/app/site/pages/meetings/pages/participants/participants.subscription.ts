import { Observable } from 'rxjs';
import { Id } from 'src/app/domain/definitions/key-types';
import { ViewMeeting } from 'src/app/site/pages/meetings/view-models/view-meeting';
import { DEFAULT_FIELDSET } from 'src/app/site/services/model-request-builder';

import { ViewUser } from '../../view-models/view-user';

export const PARTICIPANT_LIST_SUBSCRIPTION = `participant_list`;
export const PARTICIPANT_VOTE_INFO_SUBSCRIPTION = `participant_vote_info_list`;
export const PARTICIPANT_IS_PRESENT_LIST_SUBSCRIPTION = `participant_is_present_list`;
export const PARTICIPANT_LIST_SUBSCRIPTION_MINIMAL = `participant_list_minimal`;

export const getParticipantVoteInfoSubscriptionConfig = (id: Id) => ({
    modelRequest: {
        viewModelCtor: ViewMeeting,
        fieldset: [],
        ids: [id],
        follow: [
            {
                idField: `user_ids`,
                fieldset: `participantList` // TODO: Use specialised list
            }
        ]
    },
    subscriptionName: PARTICIPANT_VOTE_INFO_SUBSCRIPTION
});

export const getParticipantIsPresentSubscriptionConfig = (id: Id) => ({
    modelRequest: {
        viewModelCtor: ViewMeeting,
        fieldset: [],
        ids: [id],
        follow: [{ idField: `user_ids`, additionalFields: [`is_present_in_meeting_ids`] }]
    },
    subscriptionName: PARTICIPANT_IS_PRESENT_LIST_SUBSCRIPTION
});

export const getParticipantListSubscriptionConfig = (
    id: Id,
    hasMeetingIdChangedObservable: () => Observable<boolean>
) => ({
    modelRequest: {
        viewModelCtor: ViewMeeting,
        ids: [id],
        follow: [{ idField: `user_ids`, fieldset: `participantList` }]
    },
    subscriptionName: PARTICIPANT_LIST_SUBSCRIPTION,
    hideWhen: hasMeetingIdChangedObservable()
});

export const getParticipantMinimalSubscriptionConfig = (id: Id) => ({
    modelRequest: {
        viewModelCtor: ViewMeeting,
        ids: [id],
        follow: [{ idField: `user_ids`, fieldset: `participantListMinimal` }]
    },
    subscriptionName: PARTICIPANT_LIST_SUBSCRIPTION_MINIMAL,
    hideWhenDestroyed: true
});

export const PARTICIPANT_DETAIL_SUBSCRIPTION = `participant_detail`;

export const getParticipantDetailSubscription = (id: Id) => ({
    modelRequest: {
        viewModelCtor: ViewUser,
        ids: [id],
        fieldset: DEFAULT_FIELDSET
    },
    subscriptionName: PARTICIPANT_DETAIL_SUBSCRIPTION,
    hideWhenDestroyed: true
});
