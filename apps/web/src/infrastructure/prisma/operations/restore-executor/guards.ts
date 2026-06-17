import { OperationsApplicationError } from "@/application/operations/errors";
import { createInvalidRestoreRowError } from "@/infrastructure/prisma/operations/restore-executor/errors";
import {
  getDataSetLabel,
  getRestoreStep,
  isRestoreDataSetSupported,
} from "@/infrastructure/prisma/operations/restore-executor/plan";
import {
  collectRestoreIdentityKeys,
  readCalendarEventRows,
  readFacilityReservationRows,
  readFacilityRows,
  readMembershipRows,
  readNoticeAcknowledgementRows,
  readNoticeRows,
  readOrganizationUnitRows,
  readPermissionRows,
  readRoleAssignmentRows,
  readRolePermissionRows,
  readRoleRows,
  readUserRows,
  readWorkflowRequestRows,
  sortOrganizationUnitRows,
} from "@/infrastructure/prisma/operations/restore-executor/row-readers";
import {
  supportedOperationsRestoreDataSetKeys,
  type CalendarEventRestoreRow,
  type FacilityReservationRestoreRow,
  type MembershipRestoreRow,
  type NoticeAcknowledgementRestoreRow,
  type RoleAssignmentRestoreRow,
  type RestoreExecutorInput,
  type UserRestoreRow,
  type WorkflowRequestRestoreRow,
} from "@/infrastructure/prisma/operations/restore-executor/types";

export function getOperationsRestoreExecutorBlockedReason(
  input: RestoreExecutorInput,
) {
  if (input.restore.status !== "READY") {
    return "復元検証ステータスが READY ではないため実復元を開始できません。";
  }

  if (input.restore.restorePlan.status !== "READY") {
    return "復元計画が READY ではないため実復元を開始できません。";
  }

  if (!input.restore.restorePlan.canRestore) {
    return (
      input.restore.restorePlan.blockedReason ??
      "復元計画にブロック項目があるため実復元を開始できません。"
    );
  }

  if (
    input.currentBackupCheck.status !== "READY" ||
    !input.currentBackupCheck.matchesCurrentState
  ) {
    return "現行バックアップが現在のデータ件数と一致しないため実復元を開始できません。";
  }

  const reviewStep = input.restore.restorePlan.steps.find(
    (step) => step.status === "REVIEW_REQUIRED",
  );

  if (reviewStep) {
    return `復元計画に確認が必要なステップがあります: ${reviewStep.label}`;
  }

  const replaceStep = input.restore.restorePlan.steps.find(
    (step) => step.action === "REPLACE",
  );

  if (replaceStep) {
    return `REPLACE が必要なデータセットはまだ実復元できません: ${replaceStep.label}`;
  }

  const unsupportedStep = input.restore.restorePlan.steps.find(
    (step) =>
      step.phase === "RESTORE" &&
      step.tableKey !== null &&
      !isRestoreDataSetSupported(step.tableKey) &&
      step.action !== "SKIP",
  );

  if (unsupportedStep) {
    return `対応済みデータセット外の復元はまだ実行できません: ${unsupportedStep.label}`;
  }

  try {
    validateSupportedRestoreRows(input);
    return getIdentitySetBlockedReason(input);
  } catch (error) {
    if (error instanceof OperationsApplicationError) {
      return error.message;
    }

    throw error;
  }
}

function validateSupportedRestoreRows(input: RestoreExecutorInput) {
  const permissions = readPermissionRows(input.backup);
  const permissionIds = new Set(permissions.map((permission) => permission.id));
  const organizationUnits = readOrganizationUnitRows(
    input.backup,
    input.tenant.id,
  );
  const organizationUnitIds = new Set(
    organizationUnits.map((unit) => unit.id),
  );
  const users = readUserRows(input.backup, input.tenant.id);
  const userIds = new Set(users.map((user) => user.id));
  const memberships = readMembershipRows(input.backup, input.tenant.id);
  const membershipIds = new Set(memberships.map((membership) => membership.id));
  const roles = readRoleRows(input.backup, input.tenant.id);
  const roleIds = new Set(roles.map((role) => role.id));
  const rolePermissions = readRolePermissionRows(input.backup);
  const roleAssignments = readRoleAssignmentRows(input.backup);
  const facilities = readFacilityRows(input.backup, input.tenant.id);
  const facilityIds = new Set(facilities.map((facility) => facility.id));
  const calendarEvents = readCalendarEventRows(input.backup, input.tenant.id);
  const calendarEventIds = new Set(calendarEvents.map((event) => event.id));
  const facilityReservations = readFacilityReservationRows(
    input.backup,
    input.tenant.id,
  );
  const notices = readNoticeRows(input.backup, input.tenant.id);
  const noticeIds = new Set(notices.map((notice) => notice.id));
  const noticeAcknowledgements = readNoticeAcknowledgementRows(
    input.backup,
    input.tenant.id,
  );
  const workflowRequests = readWorkflowRequestRows(
    input.backup,
    input.tenant.id,
  );

  for (const unit of organizationUnits) {
    if (unit.parentId && !organizationUnitIds.has(unit.parentId)) {
      throw createInvalidRestoreRowError(
        "organizationUnits",
        `data.organizationUnits の parentId ${unit.parentId} がバックアップ内の組織単位に存在しません。`,
      );
    }
  }

  sortOrganizationUnitRows(organizationUnits);
  assertUniqueUserEmails(users);
  assertAuthSensitiveUserFieldsUnchanged(input, users);
  assertMembershipReferences(memberships, userIds, organizationUnitIds);
  assertUniqueMembershipAssignments(memberships);
  assertMembershipAssignmentsUnchanged(input, memberships);
  assertRoleAssignmentReferences(roleAssignments, roleIds, membershipIds);
  assertUniqueRoleAssignments(roleAssignments);
  assertRoleAssignmentsUnchanged(input, roleAssignments);
  assertCalendarEventReferences(calendarEvents, userIds, organizationUnitIds);
  assertCalendarEventCreatorsUnchanged(input, calendarEvents);
  assertFacilityReservationReferences(
    facilityReservations,
    facilityIds,
    calendarEventIds,
  );
  assertUniqueFacilityReservationEventLinks(facilityReservations);
  assertFacilityReservationLinksUnchanged(input, facilityReservations);
  assertNoticeAcknowledgementReferences(
    noticeAcknowledgements,
    noticeIds,
    userIds,
  );
  assertUniqueNoticeAcknowledgements(noticeAcknowledgements);
  assertNoticeAcknowledgementsUnchanged(input, noticeAcknowledgements);
  assertWorkflowRequestReferences(
    workflowRequests,
    userIds,
    organizationUnitIds,
  );
  assertWorkflowRequestRequestersUnchanged(input, workflowRequests);

  for (const rolePermission of rolePermissions) {
    if (!roleIds.has(rolePermission.roleId)) {
      throw createInvalidRestoreRowError(
        "rolePermissions",
        `data.rolePermissions の roleId ${rolePermission.roleId} がバックアップ内のロールに存在しません。`,
      );
    }

    if (!permissionIds.has(rolePermission.permissionId)) {
      throw createInvalidRestoreRowError(
        "rolePermissions",
        `data.rolePermissions の permissionId ${rolePermission.permissionId} がバックアップ内の権限に存在しません。`,
      );
    }
  }

  for (const facility of facilities) {
    if (
      facility.organizationUnitId &&
      !organizationUnitIds.has(facility.organizationUnitId)
    ) {
      throw createInvalidRestoreRowError(
        "facilities",
        `data.facilities の organizationUnitId ${facility.organizationUnitId} がバックアップ内の組織単位に存在しません。`,
      );
    }
  }

  for (const notice of notices) {
    if (
      notice.organizationUnitId &&
      !organizationUnitIds.has(notice.organizationUnitId)
    ) {
      throw createInvalidRestoreRowError(
        "notices",
        `data.notices の organizationUnitId ${notice.organizationUnitId} がバックアップ内の組織単位に存在しません。`,
      );
    }
  }
}

function getIdentitySetBlockedReason(input: RestoreExecutorInput) {
  for (const key of supportedOperationsRestoreDataSetKeys) {
    const step = getRestoreStep(input.restore, key);

    if (!step || step.action !== "UPSERT" || step.recordCount === 0) {
      continue;
    }

    const table = input.restore.tables.find((candidate) => candidate.key === key);

    if (!table || table.currentCount === 0) {
      continue;
    }

    const restoreKeys = collectRestoreIdentityKeys(input.backup, key);
    const currentBackupKeys = collectRestoreIdentityKeys(input.currentBackup, key);

    if (!hasSameIdentitySet(restoreKeys, currentBackupKeys)) {
      return `${getDataSetLabel(
        key,
      )} は現行バックアップと復元バックアップのID集合が一致しないため、置換扱いとして拒否しました。`;
    }
  }

  return null;
}

function hasSameIdentitySet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);

  return left.every((key) => rightSet.has(key));
}

function assertUniqueUserEmails(rows: UserRestoreRow[]) {
  const emails = new Set<string>();

  for (const row of rows) {
    const emailKey = row.email.toLowerCase();

    if (emails.has(emailKey)) {
      throw createInvalidRestoreRowError(
        "users",
        `data.users の email ${row.email} が重複しています。`,
      );
    }

    emails.add(emailKey);
  }
}

function assertAuthSensitiveUserFieldsUnchanged(
  input: RestoreExecutorInput,
  rows: UserRestoreRow[],
) {
  const currentUsers = new Map(
    readUserRows(input.currentBackup, input.tenant.id).map((row) => [
      row.id,
      row,
    ]),
  );

  for (const row of rows) {
    const currentUser = currentUsers.get(row.id);

    if (!currentUser) {
      continue;
    }

    if (currentUser.email !== row.email) {
      throw createInvalidRestoreRowError(
        "users",
        `data.users の email は認証識別子のため、このPRでは変更できません: ${row.id}`,
      );
    }

    if (currentUser.isSystemAdmin !== row.isSystemAdmin) {
      throw createInvalidRestoreRowError(
        "users",
        `data.users の isSystemAdmin は特権フラグのため、このPRでは変更できません: ${row.id}`,
      );
    }
  }
}

function assertMembershipReferences(
  rows: MembershipRestoreRow[],
  userIds: Set<string>,
  organizationUnitIds: Set<string>,
) {
  for (const row of rows) {
    if (!userIds.has(row.userId)) {
      throw createInvalidRestoreRowError(
        "memberships",
        `data.memberships の userId ${row.userId} がバックアップ内の利用者に存在しません。`,
      );
    }

    if (!organizationUnitIds.has(row.organizationUnitId)) {
      throw createInvalidRestoreRowError(
        "memberships",
        `data.memberships の organizationUnitId ${row.organizationUnitId} がバックアップ内の組織単位に存在しません。`,
      );
    }
  }
}

function assertUniqueMembershipAssignments(rows: MembershipRestoreRow[]) {
  const assignments = new Set<string>();

  for (const row of rows) {
    const key = `${row.userId}:${row.organizationUnitId}`;

    if (assignments.has(key)) {
      throw createInvalidRestoreRowError(
        "memberships",
        `data.memberships の所属 ${row.userId}/${row.organizationUnitId} が重複しています。`,
      );
    }

    assignments.add(key);
  }
}

function assertMembershipAssignmentsUnchanged(
  input: RestoreExecutorInput,
  rows: MembershipRestoreRow[],
) {
  const currentMemberships = new Map(
    readMembershipRows(input.currentBackup, input.tenant.id).map((row) => [
      row.id,
      row,
    ]),
  );

  for (const row of rows) {
    const currentMembership = currentMemberships.get(row.id);

    if (!currentMembership) {
      continue;
    }

    if (
      currentMembership.userId !== row.userId ||
      currentMembership.organizationUnitId !== row.organizationUnitId
    ) {
      throw createInvalidRestoreRowError(
        "memberships",
        `data.memberships の userId / organizationUnitId 変更は所属移動になるため、このPRでは変更できません: ${row.id}`,
      );
    }
  }
}

function assertRoleAssignmentReferences(
  rows: RoleAssignmentRestoreRow[],
  roleIds: Set<string>,
  membershipIds: Set<string>,
) {
  for (const row of rows) {
    if (!roleIds.has(row.roleId)) {
      throw createInvalidRestoreRowError(
        "roleAssignments",
        `data.roleAssignments の roleId ${row.roleId} がバックアップ内のロールに存在しません。`,
      );
    }

    if (!membershipIds.has(row.membershipId)) {
      throw createInvalidRestoreRowError(
        "roleAssignments",
        `data.roleAssignments の membershipId ${row.membershipId} がバックアップ内の所属に存在しません。`,
      );
    }
  }
}

function assertUniqueRoleAssignments(rows: RoleAssignmentRestoreRow[]) {
  const assignments = new Set<string>();

  for (const row of rows) {
    const key = `${row.roleId}:${row.membershipId}`;

    if (assignments.has(key)) {
      throw createInvalidRestoreRowError(
        "roleAssignments",
        `data.roleAssignments の割当 ${row.roleId}/${row.membershipId} が重複しています。`,
      );
    }

    assignments.add(key);
  }
}

function assertRoleAssignmentsUnchanged(
  input: RestoreExecutorInput,
  rows: RoleAssignmentRestoreRow[],
) {
  const currentRoleAssignments = new Map(
    readRoleAssignmentRows(input.currentBackup).map((row) => [row.id, row]),
  );

  for (const row of rows) {
    const currentRoleAssignment = currentRoleAssignments.get(row.id);

    if (!currentRoleAssignment) {
      continue;
    }

    if (
      currentRoleAssignment.roleId !== row.roleId ||
      currentRoleAssignment.membershipId !== row.membershipId
    ) {
      throw createInvalidRestoreRowError(
        "roleAssignments",
        `data.roleAssignments の roleId / membershipId 変更は権限割当の付け替えになるため、このPRでは変更できません: ${row.id}`,
      );
    }
  }
}

function assertCalendarEventReferences(
  rows: CalendarEventRestoreRow[],
  userIds: Set<string>,
  organizationUnitIds: Set<string>,
) {
  for (const row of rows) {
    if (!userIds.has(row.createdById)) {
      throw createInvalidRestoreRowError(
        "calendarEvents",
        `data.calendarEvents の createdById ${row.createdById} がバックアップ内の利用者に存在しません。`,
      );
    }

    if (
      row.organizationUnitId &&
      !organizationUnitIds.has(row.organizationUnitId)
    ) {
      throw createInvalidRestoreRowError(
        "calendarEvents",
        `data.calendarEvents の organizationUnitId ${row.organizationUnitId} がバックアップ内の組織単位に存在しません。`,
      );
    }
  }
}

function assertCalendarEventCreatorsUnchanged(
  input: RestoreExecutorInput,
  rows: CalendarEventRestoreRow[],
) {
  const currentCalendarEvents = new Map(
    readCalendarEventRows(input.currentBackup, input.tenant.id).map((row) => [
      row.id,
      row,
    ]),
  );

  for (const row of rows) {
    const currentCalendarEvent = currentCalendarEvents.get(row.id);

    if (!currentCalendarEvent) {
      continue;
    }

    if (currentCalendarEvent.createdById !== row.createdById) {
      throw createInvalidRestoreRowError(
        "calendarEvents",
        `data.calendarEvents の createdById 変更は予定作成者の付け替えになるため、このPRでは変更できません: ${row.id}`,
      );
    }
  }
}

function assertFacilityReservationReferences(
  rows: FacilityReservationRestoreRow[],
  facilityIds: Set<string>,
  calendarEventIds: Set<string>,
) {
  for (const row of rows) {
    if (!facilityIds.has(row.facilityId)) {
      throw createInvalidRestoreRowError(
        "facilityReservations",
        `data.facilityReservations の facilityId ${row.facilityId} がバックアップ内の施設に存在しません。`,
      );
    }

    if (row.eventId && !calendarEventIds.has(row.eventId)) {
      throw createInvalidRestoreRowError(
        "facilityReservations",
        `data.facilityReservations の eventId ${row.eventId} がバックアップ内の予定に存在しません。`,
      );
    }
  }
}

function assertUniqueFacilityReservationEventLinks(
  rows: FacilityReservationRestoreRow[],
) {
  const eventIds = new Set<string>();

  for (const row of rows) {
    if (!row.eventId) {
      continue;
    }

    if (eventIds.has(row.eventId)) {
      throw createInvalidRestoreRowError(
        "facilityReservations",
        `data.facilityReservations の eventId ${row.eventId} が重複しています。`,
      );
    }

    eventIds.add(row.eventId);
  }
}

function assertFacilityReservationLinksUnchanged(
  input: RestoreExecutorInput,
  rows: FacilityReservationRestoreRow[],
) {
  const currentFacilityReservations = new Map(
    readFacilityReservationRows(input.currentBackup, input.tenant.id).map(
      (row) => [row.id, row],
    ),
  );

  for (const row of rows) {
    const currentFacilityReservation = currentFacilityReservations.get(row.id);

    if (!currentFacilityReservation) {
      continue;
    }

    if (
      currentFacilityReservation.facilityId !== row.facilityId ||
      currentFacilityReservation.eventId !== row.eventId
    ) {
      throw createInvalidRestoreRowError(
        "facilityReservations",
        `data.facilityReservations の facilityId / eventId 変更は施設予約の付け替えになるため、このPRでは変更できません: ${row.id}`,
      );
    }
  }
}

function assertNoticeAcknowledgementReferences(
  rows: NoticeAcknowledgementRestoreRow[],
  noticeIds: Set<string>,
  userIds: Set<string>,
) {
  for (const row of rows) {
    if (!noticeIds.has(row.noticeId)) {
      throw createInvalidRestoreRowError(
        "noticeAcknowledgements",
        `data.noticeAcknowledgements の noticeId ${row.noticeId} がバックアップ内の掲示に存在しません。`,
      );
    }

    if (!userIds.has(row.userId)) {
      throw createInvalidRestoreRowError(
        "noticeAcknowledgements",
        `data.noticeAcknowledgements の userId ${row.userId} がバックアップ内の利用者に存在しません。`,
      );
    }
  }
}

function assertUniqueNoticeAcknowledgements(
  rows: NoticeAcknowledgementRestoreRow[],
) {
  const acknowledgements = new Set<string>();

  for (const row of rows) {
    const key = `${row.noticeId}:${row.userId}`;

    if (acknowledgements.has(key)) {
      throw createInvalidRestoreRowError(
        "noticeAcknowledgements",
        `data.noticeAcknowledgements の既読確認 ${row.noticeId}/${row.userId} が重複しています。`,
      );
    }

    acknowledgements.add(key);
  }
}

function assertNoticeAcknowledgementsUnchanged(
  input: RestoreExecutorInput,
  rows: NoticeAcknowledgementRestoreRow[],
) {
  const currentNoticeAcknowledgements = new Map(
    readNoticeAcknowledgementRows(input.currentBackup, input.tenant.id).map(
      (row) => [row.id, row],
    ),
  );

  for (const row of rows) {
    const currentNoticeAcknowledgement = currentNoticeAcknowledgements.get(row.id);

    if (!currentNoticeAcknowledgement) {
      continue;
    }

    if (
      currentNoticeAcknowledgement.noticeId !== row.noticeId ||
      currentNoticeAcknowledgement.userId !== row.userId
    ) {
      throw createInvalidRestoreRowError(
        "noticeAcknowledgements",
        `data.noticeAcknowledgements の noticeId / userId 変更は既読確認の付け替えになるため、このPRでは変更できません: ${row.id}`,
      );
    }
  }
}

function assertWorkflowRequestReferences(
  rows: WorkflowRequestRestoreRow[],
  userIds: Set<string>,
  organizationUnitIds: Set<string>,
) {
  for (const row of rows) {
    if (!userIds.has(row.requesterId)) {
      throw createInvalidRestoreRowError(
        "workflowRequests",
        `data.workflowRequests の requesterId ${row.requesterId} がバックアップ内の利用者に存在しません。`,
      );
    }

    if (
      row.organizationUnitId &&
      !organizationUnitIds.has(row.organizationUnitId)
    ) {
      throw createInvalidRestoreRowError(
        "workflowRequests",
        `data.workflowRequests の organizationUnitId ${row.organizationUnitId} がバックアップ内の組織単位に存在しません。`,
      );
    }
  }
}

function assertWorkflowRequestRequestersUnchanged(
  input: RestoreExecutorInput,
  rows: WorkflowRequestRestoreRow[],
) {
  const currentWorkflowRequests = new Map(
    readWorkflowRequestRows(input.currentBackup, input.tenant.id).map((row) => [
      row.id,
      row,
    ]),
  );

  for (const row of rows) {
    const currentWorkflowRequest = currentWorkflowRequests.get(row.id);

    if (!currentWorkflowRequest) {
      continue;
    }

    if (currentWorkflowRequest.requesterId !== row.requesterId) {
      throw createInvalidRestoreRowError(
        "workflowRequests",
        `data.workflowRequests の requesterId 変更は申請者の付け替えになるため、このPRでは変更できません: ${row.id}`,
      );
    }
  }
}
