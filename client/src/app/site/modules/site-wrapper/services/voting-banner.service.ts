import { inject, Service } from '@angular/core';
import { Id } from '@app/domain/definitions/key-types';
import { Permission } from '@app/domain/definitions/permission';
import { viewModelListEqual } from '@app/infrastructure/utils';
import { VotingService } from '@app/site/pages/meetings/modules/poll/services/voting.service';
import { ViewPoll } from '@app/site/pages/meetings/pages/polls/view-models';
import { ActiveMeetingService } from '@app/site/pages/meetings/services/active-meeting.service';
import { ActivePollsService } from '@app/site/pages/meetings/services/active-polls.service';
import { MeetingSettingsService } from '@app/site/pages/meetings/services/meeting-settings.service';
import { OperatorService } from '@app/site/services/operator.service';
import { _ } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { BannerDefinition, BannerService } from './banner.service';

interface BannerCreationData {
    text: string;
    link: string;
}

@Service()
export class VotingBannerService {
    private currentBanner: BannerDefinition;

    private subText = _(`Click here to vote!`);

    private pollsToVote: ViewPoll[] = [];

    private banner = inject(BannerService);
    private translate = inject(TranslateService);
    private votingService = inject(VotingService);
    private activeMeeting = inject(ActiveMeetingService);
    private operator = inject(OperatorService);
    private activePolls = inject(ActivePollsService);
    private meetingSettingsService = inject(MeetingSettingsService);

    public constructor() {
        combineLatest([
            this.activeMeeting.meetingIdObservable.pipe(distinctUntilChanged()),
            this.activePolls.activePollsObservable.pipe(
                distinctUntilChanged((l1, l2) => viewModelListEqual(l1, l2, false))
            ),
            this.meetingSettingsService.get(`users_enable_vote_delegations`).pipe(distinctUntilChanged()),
            this.meetingSettingsService.get(`users_forbid_delegator_to_vote`).pipe(distinctUntilChanged()),
            this.operator.userObservable.pipe(
                distinctUntilChanged((p, c) => p?.isPresentInMeeting() === c?.isPresentInMeeting())
            )
        ])
            .pipe(
                switchMap(([_, polls]) => {
                    if (!polls.length) {
                        return of([polls, {}] as const);
                    }

                    const checkUsers = [this.operator.user, ...(this.operator.user.vote_delegations_from() || [])];
                    return combineLatest(
                        polls.map(poll =>
                            combineLatest(
                                checkUsers.map(user =>
                                    this.votingService.hasVotedObservable(poll, user.getMeetingUser())
                                )
                            ).pipe(map(voted => [poll.id, voted.some(Boolean)] as const))
                        )
                    ).pipe(map(voted => [polls, Object.fromEntries(voted)] as const));
                })
            )
            .subscribe(([polls, voted]) => this.updateBanner(polls, voted));
    }

    private updateBanner(polls: ViewPoll[], voted: Record<Id, boolean>): void {
        if (this.activeMeeting.meetingId && !this.operator.isAnonymous && this.operator.readyDeferred.wasResolved) {
            this.pollsToVote = polls.filter(poll => voted[poll.id] === false);
        } else {
            this.pollsToVote = [];
        }

        // display no banner if no polls to vote
        if (!this.pollsToVote.length) {
            this.sliceBanner();
            return;
        }

        const { text, link } = this.getBannerCreationData();
        const banner = this.createBanner(text, link);
        this.sliceBanner(banner);
    }

    /**
     * Creates a new `BannerDefinition` and returns it.
     *
     * @param text The text for the banner.
     * @param link The link for the banner.
     *
     * @returns The created banner.
     */
    private createBanner(text: string, link: string): BannerDefinition {
        return {
            text,
            subText: this.subText,
            link,
            icon: `how_to_vote`,
            largerOnMobileView: true
        };
    }

    private getBannerCreationData(): BannerCreationData {
        const isSinglePoll = this.pollsToVote.length === 1;
        const text = isSinglePoll
            ? this.getTextForPoll(this.getSinglePoll())
            : `${this.pollsToVote.length} ${this.translate.instant(`open votes`)}`;
        const link = this.getPollOverviewUrl(isSinglePoll);
        return { text, link };
    }

    private getPollOverviewUrl(isSinglePoll: boolean): string {
        if (this.operator.hasPerms(Permission.meetingCanSeeAutopilot)) {
            return `/${this.activeMeeting.meetingId}/autopilot/`;
        } else if (isSinglePoll) {
            return this.pollsToVote[0].getDetailStateUrl();
        }
        return `/${this.activeMeeting.meetingId}/polls/`;
    }

    private getSinglePoll(): ViewPoll {
        return this.pollsToVote[0];
    }

    /**
     * Returns for a given poll a title for the banner.
     *
     * @param poll The given poll.
     *
     * @returns The title.
     */
    private getTextForPoll(poll: ViewPoll): string {
        const contentObject = poll.getContentObject();
        if (contentObject) {
            return contentObject.getVotingText({ poll, translateFn: text => this.translate.instant(text) });
        } else {
            return this.translate.instant(`Voting opened`);
        }
    }

    /**
     * Removes the current banner or replaces it, if a new one is given.
     *
     * @param nextBanner Optional the next banner to show.
     */
    private sliceBanner(nextBanner?: BannerDefinition): void {
        if (nextBanner) {
            this.banner.replaceBanner(this.currentBanner, nextBanner);
        } else {
            this.banner.removeBanner(this.currentBanner);
        }
        this.currentBanner = nextBanner || null;
    }
}
