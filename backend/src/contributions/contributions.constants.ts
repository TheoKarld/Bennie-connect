/**
 * Error codes for the Adashe / contribution-groups module.
 * User plane: ADS_*  ·  Admin plane: ADS_ADM_*
 */
export const ADS_ERRORS = {
  GROUP_NOT_FOUND: {
    code: 'ADS_001',
    message: 'Contribution group not found',
  },
  NOT_A_MEMBER: {
    code: 'ADS_002',
    message: 'You are not a member of this group',
  },
  NOT_ACTIVE_MEMBER: {
    code: 'ADS_003',
    message: 'You are not an active member of this group',
  },
  INVITE_TARGET_NOT_REGISTERED: {
    code: 'ADS_004',
    message: 'No registered user found for that email',
  },
  ALREADY_MEMBER: {
    code: 'ADS_005',
    message: 'That user is already a member of this group',
  },
  ALREADY_INVITED: {
    code: 'ADS_006',
    message: 'That email already has a pending invitation to this group',
  },
  GROUP_FULL: {
    code: 'ADS_007',
    message: 'This group has reached its maximum number of members',
  },
  INVITATION_NOT_FOUND: {
    code: 'ADS_008',
    message: 'Invitation not found',
  },
  INVITATION_NOT_PENDING: {
    code: 'ADS_009',
    message: 'This invitation is no longer pending',
  },
  INVITATION_NOT_YOURS: {
    code: 'ADS_010',
    message: 'This invitation does not belong to you',
  },
  GROUP_NOT_ACTIVE: {
    code: 'ADS_011',
    message: 'This group is not active',
  },
  PROPOSAL_NOT_FOUND: {
    code: 'ADS_012',
    message: 'Proposal not found',
  },
  PROPOSAL_NOT_ACTIVE: {
    code: 'ADS_013',
    message: 'This proposal is not open for voting',
  },
  ALREADY_VOTED: {
    code: 'ADS_014',
    message: 'You have already voted on this proposal',
  },
  SLOT_SHIFT_TARGET_INVALID: {
    code: 'ADS_015',
    message: 'The chosen swap target is not a valid active member',
  },
  SLOT_SHIFT_SELF: {
    code: 'ADS_016',
    message: 'You cannot request a slot swap with yourself',
  },
  ATTENDANCE_NOT_FOUND: {
    code: 'ADS_017',
    message: 'Attendance session not found',
  },
  ALREADY_CHECKED_IN: {
    code: 'ADS_018',
    message: 'You have already checked in for this session',
  },
  PAYOUT_NOT_YOUR_TURN: {
    code: 'ADS_019',
    message: 'It is not your turn in the rotation',
  },
  PAYOUT_ALREADY_REQUESTED: {
    code: 'ADS_020',
    message: 'A payout request already exists for this turn',
  },
  PAYOUT_REQUEST_NOT_FOUND: {
    code: 'ADS_021',
    message: 'Payout request not found',
  },
  PAYOUT_NOT_RECIPIENT: {
    code: 'ADS_022',
    message: 'You are not the recipient of this payout',
  },
  PAYOUT_NOT_MARKED_SENT: {
    code: 'ADS_023',
    message: 'This payout has not been marked sent by an admin yet',
  },
  INVALID_ID: {
    code: 'ADS_024',
    message: 'Invalid identifier',
  },
  NO_ELIGIBLE_TURN: {
    code: 'ADS_025',
    message: 'No unpaid rotation turn is available for you to claim',
  },
} as const;

export const ADS_ADM_ERRORS = {
  GROUP_NOT_FOUND: { code: 'ADS_ADM_001', message: 'Group not found' },
  PAYOUT_REQUEST_NOT_FOUND: {
    code: 'ADS_ADM_002',
    message: 'Payout request not found',
  },
  PAYOUT_NOT_REQUESTED: {
    code: 'ADS_ADM_003',
    message: 'This payout request is not in REQUESTED state',
  },
  PROPOSAL_NOT_FOUND: { code: 'ADS_ADM_004', message: 'Proposal not found' },
  PROPOSAL_NOT_AWAITING_ADMIN: {
    code: 'ADS_ADM_005',
    message: 'This proposal is not awaiting an admin decision',
  },
  INVALID_STATUS_TRANSITION: {
    code: 'ADS_ADM_006',
    message: 'Invalid group status transition',
  },
  INVALID_ID: { code: 'ADS_ADM_007', message: 'Invalid identifier' },
  INVITE_TARGET_NOT_REGISTERED: {
    code: 'ADS_ADM_008',
    message: 'No registered user found for that email',
  },
} as const;

/** Notification event names emitted through NotificationService. */
export const ADS_EVENTS = {
  GROUP_INVITE: 'adashe.group.invite',
  INVITE_ACCEPTED: 'adashe.invite.accepted',
  MEMBER_JOINED: 'adashe.member.joined',
  CONTRIBUTION_RECORDED: 'adashe.contribution.recorded',
  PROPOSAL_CREATED: 'adashe.proposal.created',
  PROPOSAL_VOTE: 'adashe.proposal.vote',
  PROPOSAL_AWAITING_ADMIN: 'adashe.proposal.awaiting_admin',
  PROPOSAL_DECIDED: 'adashe.proposal.decided',
  SLOT_SHIFT_REQUESTED: 'adashe.slot_shift.requested',
  ATTENDANCE_CHECK_IN: 'adashe.attendance.check_in',
  PAYOUT_REQUESTED: 'adashe.payout.requested',
  PAYOUT_MARKED_SENT: 'adashe.payout.marked_sent',
  PAYOUT_CONFIRMED: 'adashe.payout.confirmed',
  GROUP_SUSPENDED: 'adashe.group.suspended',
  GROUP_REINSTATED: 'adashe.group.reinstated',
  RULES_UPDATED: 'adashe.rules.updated',
} as const;
