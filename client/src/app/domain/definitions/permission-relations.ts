// THIS FILE IS GENERATED AUTOMATICALLY. DO NOT CHANGE IT MANUALLY.
import { Permission } from './permission';
import { PermissionsMap } from './permission.config';

export const permissionChildren: PermissionsMap = {
    'agenda_item.can_manage': [Permission.agendaItemCanSeeInternal, Permission.agendaItemCanSee],
    'agenda_item.can_manage_moderator_notes': [Permission.agendaItemCanSeeModeratorNotes, Permission.agendaItemCanSee],
    'agenda_item.can_see': [],
    'agenda_item.can_see_internal': [Permission.agendaItemCanSee],
    'agenda_item.can_see_moderator_notes': [Permission.agendaItemCanSee],
    'assignment.can_manage': [Permission.assignmentCanNominateOther, Permission.assignmentCanSee],
    'assignment.can_nominate_other': [Permission.assignmentCanSee],
    'assignment.can_nominate_self': [Permission.assignmentCanSee],
    'assignment.can_see': [],
    'chat.can_manage': [],
    'list_of_speakers.can_be_speaker': [],
    'list_of_speakers.can_manage': [Permission.listOfSpeakersCanSee],
    'list_of_speakers.can_see': [],
    'mediafile.can_manage': [Permission.mediafileCanSee],
    'mediafile.can_see': [],
    'meeting.can_manage_logos_and_fonts': [],
    'meeting.can_manage_settings': [],
    'meeting.can_see_autopilot': [],
    'meeting.can_see_frontpage': [],
    'meeting.can_see_history': [],
    'meeting.can_see_livestream': [],
    'motion.can_create': [Permission.motionCanSee],
    'motion.can_create_amendments': [Permission.motionCanSee],
    'motion.can_forward': [Permission.motionCanSee],
    'motion.can_manage': [
        Permission.motionCanManageMetadata,
        Permission.motionCanSee,
        Permission.motionCanManagePolls,
        Permission.motionCanSeeInternal,
        Permission.motionCanCreate,
        Permission.motionCanCreateAmendments,
        Permission.motionCanForward
    ],
    'motion.can_manage_metadata': [Permission.motionCanSee],
    'motion.can_manage_polls': [Permission.motionCanSee],
    'motion.can_see': [],
    'motion.can_see_internal': [Permission.motionCanSee],
    'motion.can_see_origin': [Permission.motionCanSee],
    'motion.can_support': [Permission.motionCanSee],
    'poll.can_manage': [],
    'projector.can_manage': [Permission.projectorCanSee],
    'projector.can_see': [],
    'tag.can_manage': [],
    'user.can_manage': [
        Permission.userCanManagePresence,
        Permission.userCanSee,
        Permission.userCanUpdate,
        Permission.userCanSeeSensitiveData
    ],
    'user.can_manage_presence': [Permission.userCanSee],
    'user.can_see': [],
    'user.can_see_sensitive_data': [Permission.userCanSee],
    'user.can_update': [Permission.userCanSeeSensitiveData, Permission.userCanSee]
};

export const permissionParents: PermissionsMap = {
    'agenda_item.can_manage': [],
    'agenda_item.can_manage_moderator_notes': [],
    'agenda_item.can_see': [
        Permission.agendaItemCanSeeInternal,
        Permission.agendaItemCanManage,
        Permission.agendaItemCanSeeModeratorNotes,
        Permission.agendaItemCanManageModeratorNotes
    ],
    'agenda_item.can_see_internal': [Permission.agendaItemCanManage],
    'agenda_item.can_see_moderator_notes': [Permission.agendaItemCanManageModeratorNotes],
    'assignment.can_manage': [],
    'assignment.can_nominate_other': [Permission.assignmentCanManage],
    'assignment.can_nominate_self': [],
    'assignment.can_see': [
        Permission.assignmentCanNominateOther,
        Permission.assignmentCanManage,
        Permission.assignmentCanNominateSelf
    ],
    'chat.can_manage': [],
    'list_of_speakers.can_be_speaker': [],
    'list_of_speakers.can_manage': [],
    'list_of_speakers.can_see': [Permission.listOfSpeakersCanManage],
    'mediafile.can_manage': [],
    'mediafile.can_see': [Permission.mediafileCanManage],
    'meeting.can_manage_logos_and_fonts': [],
    'meeting.can_manage_settings': [],
    'meeting.can_see_autopilot': [],
    'meeting.can_see_frontpage': [],
    'meeting.can_see_history': [],
    'meeting.can_see_livestream': [],
    'motion.can_create': [Permission.motionCanManage],
    'motion.can_create_amendments': [Permission.motionCanManage],
    'motion.can_forward': [Permission.motionCanManage],
    'motion.can_manage': [],
    'motion.can_manage_metadata': [Permission.motionCanManage],
    'motion.can_manage_polls': [Permission.motionCanManage],
    'motion.can_see': [
        Permission.motionCanManageMetadata,
        Permission.motionCanManage,
        Permission.motionCanManagePolls,
        Permission.motionCanSeeInternal,
        Permission.motionCanCreate,
        Permission.motionCanCreateAmendments,
        Permission.motionCanForward,
        Permission.motionCanSupport,
        Permission.motionCanSeeOrigin
    ],
    'motion.can_see_origin': [],
    'motion.can_see_internal': [Permission.motionCanManage],
    'motion.can_support': [],
    'poll.can_manage': [],
    'projector.can_manage': [],
    'projector.can_see': [Permission.projectorCanManage],
    'tag.can_manage': [],
    'user.can_manage': [],
    'user.can_manage_presence': [Permission.userCanManage],
    'user.can_see': [
        Permission.userCanManagePresence,
        Permission.userCanManage,
        Permission.userCanSeeSensitiveData,
        Permission.userCanUpdate
    ],
    'user.can_see_sensitive_data': [Permission.userCanUpdate, Permission.userCanManage],
    'user.can_update': [Permission.userCanManage]
};
