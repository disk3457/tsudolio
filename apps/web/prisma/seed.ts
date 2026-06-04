import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import {
  AuditSeverity,
  DocumentStatus,
  FacilityStatus,
  OrganizationUnitKind,
  TenantType,
  WorkflowPriority,
  WorkflowStatus,
} from "../generated/prisma/enums";
import { getDatabaseUrl } from "../src/infrastructure/database/database-url";
import { hashPassword } from "../src/infrastructure/auth/password";

const adapter = new PrismaPg({
  connectionString: getDatabaseUrl(),
});

const prisma = new PrismaClient({ adapter });
const localTenantCode = process.env.TSUDOLIO_TENANT_CODE ?? "tsudolio-local";
const localTenantName = "つどりお総合病院";

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { code: localTenantCode },
    create: {
      code: localTenantCode,
      name: localTenantName,
      displayName: localTenantName,
      type: TenantType.HYBRID,
      timezone: "Asia/Tokyo",
    },
    update: {
      name: localTenantName,
      displayName: localTenantName,
      type: TenantType.HYBRID,
      timezone: "Asia/Tokyo",
    },
  });

  const generalAffairs = await upsertOrganizationUnit(tenant.id, {
    code: "general-affairs",
    name: "総務課",
    kind: OrganizationUnitKind.DEPARTMENT,
    path: "/総務課",
    sortOrder: 10,
  });
  const security = await upsertOrganizationUnit(tenant.id, {
    code: "security-policy",
    name: "防災安全課",
    kind: OrganizationUnitKind.DEPARTMENT,
    parentId: generalAffairs.id,
    path: "/総務課/防災安全課",
    sortOrder: 20,
  });
  const information = await upsertOrganizationUnit(tenant.id, {
    code: "information-policy",
    name: "情報政策課",
    kind: OrganizationUnitKind.DEPARTMENT,
    parentId: generalAffairs.id,
    path: "/総務課/情報政策課",
    sortOrder: 30,
  });
  const medicalSafety = await upsertOrganizationUnit(tenant.id, {
    code: "medical-safety",
    name: "医療安全管理室",
    kind: OrganizationUnitKind.WARD,
    path: "/医療安全管理室",
    sortOrder: 40,
  });
  const facilityManagement = await upsertOrganizationUnit(tenant.id, {
    code: "facility-management",
    name: "施設管理",
    kind: OrganizationUnitKind.TEAM,
    parentId: medicalSafety.id,
    path: "/医療安全管理室/施設管理",
    sortOrder: 50,
  });

  const admin = await upsertUser(tenant.id, {
    email: "admin@tsudolio.local",
    displayName: "佐藤 管理者",
    kanaName: "サトウ カンリシャ",
    title: "システム管理者",
    isSystemAdmin: true,
  });
  await upsertUserCredential(
    tenant.id,
    admin.id,
    process.env.TSUDOLIO_SEED_ADMIN_PASSWORD ?? "change-me-in-local-only",
  );
  const approver = await upsertUser(tenant.id, {
    email: "approver@tsudolio.local",
    displayName: "中村 承認者",
    kanaName: "ナカムラ ショウニンシャ",
    title: "室長",
  });
  const requester = await upsertUser(tenant.id, {
    email: "requester@tsudolio.local",
    displayName: "田中 申請者",
    kanaName: "タナカ シンセイシャ",
    title: "主査",
  });

  const adminMembership = await upsertMembership(
    tenant.id,
    admin.id,
    information.id,
  );
  const approverMembership = await upsertMembership(
    tenant.id,
    approver.id,
    medicalSafety.id,
  );
  await upsertMembership(tenant.id, requester.id, security.id);

  const [
    manageTenant,
    manageOrganization,
    manageSchedule,
    manageNotices,
    manageDocuments,
    approveWorkflow,
    readDocuments,
  ] = await Promise.all([
    upsertPermission("tenant.manage", "テナント設定を管理"),
    upsertPermission("organization.manage", "組織・利用者を管理"),
    upsertPermission("schedule.manage", "予定・施設予約を管理"),
    upsertPermission("notice.manage", "掲示・通知を管理"),
    upsertPermission("document.manage", "文書を管理"),
    upsertPermission("workflow.approve", "申請を承認"),
    upsertPermission("document.read", "文書を閲覧"),
  ]);

  const adminRole = await upsertRole(tenant.id, {
    code: "system-admin",
    name: "システム管理者",
    description: "全体設定、監査、権限を管理します。",
  });
  const approverRole = await upsertRole(tenant.id, {
    code: "workflow-approver",
    name: "承認者",
    description: "所属組織の申請を確認し、承認します。",
  });

  await Promise.all([
    attachPermission(adminRole.id, manageTenant.id),
    attachPermission(adminRole.id, manageOrganization.id),
    attachPermission(adminRole.id, manageSchedule.id),
    attachPermission(adminRole.id, manageNotices.id),
    attachPermission(adminRole.id, manageDocuments.id),
    attachPermission(adminRole.id, approveWorkflow.id),
    attachPermission(adminRole.id, readDocuments.id),
    attachPermission(approverRole.id, approveWorkflow.id),
    attachPermission(approverRole.id, readDocuments.id),
    assignRole(adminRole.id, adminMembership.id),
    assignRole(approverRole.id, approverMembership.id),
  ]);

  const firstRoom = await upsertFacility(tenant.id, information.id, {
    code: "meeting-room-1",
    name: "第1会議室",
    status: FacilityStatus.IN_USE,
    capacity: 16,
    location: "本庁舎 3F",
  });
  const largeRoom = await upsertFacility(tenant.id, generalAffairs.id, {
    code: "large-hall",
    name: "大会議室",
    status: FacilityStatus.AVAILABLE,
    capacity: 80,
    location: "本庁舎 5F",
  });
  await upsertFacility(tenant.id, facilityManagement.id, {
    code: "vehicle-02",
    name: "公用車 02",
    status: FacilityStatus.APPROVAL_REQUIRED,
    capacity: 5,
    location: "車両管理棟",
  });

  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.auditEvent.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.facilityReservation.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.calendarEvent.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.workflowRequest.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.documentVersion.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.document.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.noticeAcknowledgement.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.notice.deleteMany({ where: { tenantId: tenant.id } }),
  ]);

  const now = new Date();
  const eventOne = await prisma.calendarEvent.create({
    data: {
      tenantId: tenant.id,
      organizationUnitId: generalAffairs.id,
      createdById: admin.id,
      title: "災害対策連絡会",
      startsAt: addHours(now, 2),
      endsAt: addHours(now, 3),
      location: "第2会議室",
      visibility: "TENANT",
    },
  });

  await prisma.calendarEvent.createMany({
    data: [
      {
        tenantId: tenant.id,
        organizationUnitId: facilityManagement.id,
        createdById: requester.id,
        title: "院内設備点検",
        startsAt: addHours(now, 4),
        endsAt: addHours(now, 5),
        location: "施設管理",
        visibility: "ORGANIZATION",
      },
      {
        tenantId: tenant.id,
        organizationUnitId: information.id,
        createdById: admin.id,
        title: "情報セキュリティ確認",
        startsAt: addHours(now, 6),
        endsAt: addHours(now, 7),
        location: "情報政策課",
        visibility: "ORGANIZATION",
      },
      {
        tenantId: tenant.id,
        organizationUnitId: medicalSafety.id,
        createdById: approver.id,
        title: "地域連携カンファレンス",
        startsAt: addDays(now, 1),
        endsAt: addDays(addHours(now, 1), 1),
        location: "オンライン",
        visibility: "TENANT",
      },
    ],
  });

  await prisma.facilityReservation.create({
    data: {
      tenantId: tenant.id,
      facilityId: firstRoom.id,
      eventId: eventOne.id,
      startsAt: eventOne.startsAt,
      endsAt: eventOne.endsAt,
      purpose: "災害対策連絡会",
      status: WorkflowStatus.APPROVED,
    },
  });

  await prisma.facilityReservation.create({
    data: {
      tenantId: tenant.id,
      facilityId: largeRoom.id,
      startsAt: addDays(now, 1),
      endsAt: addDays(addHours(now, 2), 1),
      purpose: "定例部長会",
      status: WorkflowStatus.PENDING,
    },
  });

  await prisma.workflowRequest.createMany({
    data: [
      {
        tenantId: tenant.id,
        organizationUnitId: medicalSafety.id,
        requesterId: requester.id,
        title: "個人情報取扱区域への入室申請",
        category: "入退室",
        description: "監査資料の確認のため、医療安全管理室の入室権限を一時付与してください。",
        status: WorkflowStatus.PENDING,
        priority: WorkflowPriority.HIGH,
        dueAt: addHours(now, 8),
        submittedAt: now,
      },
      {
        tenantId: tenant.id,
        organizationUnitId: security.id,
        requesterId: requester.id,
        title: "庁外会議用端末の持出申請",
        category: "端末持出",
        description: "庁外会議で利用する端末を翌営業日まで持ち出します。",
        status: WorkflowStatus.PENDING,
        priority: WorkflowPriority.NORMAL,
        dueAt: addDays(now, 1),
        submittedAt: now,
      },
      {
        tenantId: tenant.id,
        organizationUnitId: information.id,
        requesterId: admin.id,
        title: "新規委託先アカウント発行",
        category: "アカウント",
        description: "委託先担当者の初期アカウントを発行し、期限付きで共有します。",
        status: WorkflowStatus.PENDING,
        priority: WorkflowPriority.HIGH,
        dueAt: addDays(now, 4),
        submittedAt: now,
      },
    ],
  });

  await prisma.notice.createMany({
    data: [
      {
        tenantId: tenant.id,
        organizationUnitId: generalAffairs.id,
        title: "年度更新作業のお知らせ",
        body: "年度更新に伴う各部署の確認事項を掲載しました。",
        requiresAck: true,
        publishedAt: now,
        expiresAt: addDays(now, 14),
      },
      {
        tenantId: tenant.id,
        organizationUnitId: information.id,
        title: "パスワードレス認証の試行開始",
        body: "一部部署でパスワードレス認証の検証を開始します。",
        requiresAck: false,
        publishedAt: now,
        expiresAt: addDays(now, 30),
      },
    ],
  });

  const privacyManual = await prisma.document.create({
    data: {
      tenantId: tenant.id,
      organizationUnitId: information.id,
      uploadedById: admin.id,
      title: "個人情報取扱マニュアル",
      category: "セキュリティ",
      version: "v3.2",
      status: DocumentStatus.ACTIVE,
      storageKey: "documents/security/privacy-manual-v3.2.pdf",
      retentionUntil: addYears(now, 5),
    },
  });
  const emergencyContact = await prisma.document.create({
    data: {
      tenantId: tenant.id,
      organizationUnitId: security.id,
      uploadedById: requester.id,
      title: "災害時連絡体制",
      category: "BCP",
      version: "v1.8",
      status: DocumentStatus.ACTIVE,
      storageKey: "documents/bcp/emergency-contact-v1.8.pdf",
      retentionUntil: addYears(now, 7),
    },
  });

  await prisma.documentVersion.createMany({
    data: [
      {
        tenantId: tenant.id,
        documentId: privacyManual.id,
        organizationUnitId: information.id,
        createdById: admin.id,
        title: privacyManual.title,
        category: privacyManual.category,
        version: "v3.0",
        status: DocumentStatus.ARCHIVED,
        storageKey: "documents/security/privacy-manual-v3.0.pdf",
        retentionUntil: addYears(now, 5),
        changeNote: "旧版を保管",
      },
      {
        tenantId: tenant.id,
        documentId: privacyManual.id,
        organizationUnitId: information.id,
        createdById: admin.id,
        title: privacyManual.title,
        category: privacyManual.category,
        version: privacyManual.version,
        status: privacyManual.status,
        storageKey: privacyManual.storageKey,
        retentionUntil: privacyManual.retentionUntil,
        changeNote: "最新版を公開",
      },
      {
        tenantId: tenant.id,
        documentId: emergencyContact.id,
        organizationUnitId: security.id,
        createdById: requester.id,
        title: emergencyContact.title,
        category: emergencyContact.category,
        version: emergencyContact.version,
        status: emergencyContact.status,
        storageKey: emergencyContact.storageKey,
        retentionUntil: emergencyContact.retentionUntil,
        changeNote: "最新版を公開",
      },
    ],
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        tenantId: tenant.id,
        actorId: admin.id,
        action: "多要素認証設定を更新",
        targetType: "tenant",
        targetId: tenant.id,
        severity: AuditSeverity.NOTICE,
        ipAddress: "192.0.2.24",
        metadata: { method: "passkey" },
      },
      {
        tenantId: tenant.id,
        actorId: admin.id,
        action: "共有文書の閲覧権限を変更",
        targetType: "document",
        targetId: "privacy-manual",
        severity: AuditSeverity.WARNING,
        ipAddress: "192.0.2.24",
        metadata: { category: "security" },
      },
      {
        tenantId: tenant.id,
        actorId: approver.id,
        action: "庁外端末持出申請を承認",
        targetType: "workflow_request",
        targetId: "device-carry-out",
        severity: AuditSeverity.INFO,
        ipAddress: "192.0.2.25",
        metadata: { workflow: "device" },
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: admin.id,
        title: "承認期限が近い申請があります",
        body: "本日中に確認が必要な申請が2件あります。",
      },
      {
        tenantId: tenant.id,
        userId: approver.id,
        title: "重要掲示の確認依頼",
        body: "年度更新作業のお知らせを確認してください。",
      },
    ],
  });
}

async function upsertOrganizationUnit(
  tenantId: string,
  data: {
    code: string;
    name: string;
    kind: OrganizationUnitKind;
    path: string;
    sortOrder: number;
    parentId?: string;
  },
) {
  return prisma.organizationUnit.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code: data.code,
      },
    },
    create: {
      tenantId,
      ...data,
    },
    update: data,
  });
}

async function upsertUser(
  tenantId: string,
  data: {
    email: string;
    displayName: string;
    kanaName: string;
    title: string;
    isSystemAdmin?: boolean;
  },
) {
  return prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email: data.email,
      },
    },
    create: {
      tenantId,
      ...data,
    },
    update: data,
  });
}

async function upsertUserCredential(
  tenantId: string,
  userId: string,
  password: string,
) {
  const passwordHash = await hashPassword(password);

  return prisma.userCredential.upsert({
    where: {
      userId,
    },
    create: {
      tenantId,
      userId,
      passwordHash,
    },
    update: {
      passwordHash,
      passwordChangedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
}

async function upsertMembership(
  tenantId: string,
  userId: string,
  organizationUnitId: string,
) {
  return prisma.membership.upsert({
    where: {
      tenantId_userId_organizationUnitId: {
        tenantId,
        userId,
        organizationUnitId,
      },
    },
    create: {
      tenantId,
      userId,
      organizationUnitId,
      status: "ACTIVE",
    },
    update: {
      status: "ACTIVE",
      leftAt: null,
    },
  });
}

async function upsertPermission(code: string, name: string) {
  return prisma.permission.upsert({
    where: { code },
    create: { code, name },
    update: { name },
  });
}

async function upsertRole(
  tenantId: string,
  data: {
    code: string;
    name: string;
    description: string;
  },
) {
  return prisma.role.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code: data.code,
      },
    },
    create: {
      tenantId,
      ...data,
    },
    update: data,
  });
}

async function attachPermission(roleId: string, permissionId: string) {
  return prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId,
        permissionId,
      },
    },
    create: {
      roleId,
      permissionId,
    },
    update: {},
  });
}

async function assignRole(roleId: string, membershipId: string) {
  return prisma.roleAssignment.upsert({
    where: {
      roleId_membershipId: {
        roleId,
        membershipId,
      },
    },
    create: {
      roleId,
      membershipId,
    },
    update: {},
  });
}

async function upsertFacility(
  tenantId: string,
  organizationUnitId: string,
  data: {
    code: string;
    name: string;
    status: FacilityStatus;
    capacity: number;
    location: string;
  },
) {
  return prisma.facility.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code: data.code,
      },
    },
    create: {
      tenantId,
      organizationUnitId,
      ...data,
    },
    update: {
      organizationUnitId,
      ...data,
    },
  });
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
