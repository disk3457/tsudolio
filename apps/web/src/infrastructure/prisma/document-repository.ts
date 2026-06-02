import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { DocumentRepository } from "@/application/documents/use-cases";
import type {
  DocumentAccessSummary,
  DocumentInput,
  DocumentSnapshot,
  DocumentSummary,
  DocumentVersionSummary,
} from "@/application/documents/types";
import type { MutationContext } from "@/application/security/types";
import { DocumentApplicationError } from "@/application/documents/errors";
import { recordAuditEvent } from "@/infrastructure/prisma/audit-event-repository";
import type { Prisma } from "@generated/prisma/client";
import {
  AuditSeverity,
  DocumentStatus,
} from "@generated/prisma/enums";

export async function getDocumentSnapshot(
  tenantCode: string,
): Promise<DocumentSnapshot> {
  const tenant = await getTenantOrThrow(tenantCode);
  const [documents, organizationUnits] = await Promise.all([
    findDocuments(tenant.id),
    prisma.organizationUnit.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return {
    tenant: {
      code: tenant.code,
      name: tenant.displayName ?? tenant.name,
      timezone: tenant.timezone,
    },
    documents: documents.map(mapDocument),
    categories: Array.from(
      new Set(documents.map((document) => document.category)),
    ).sort((a, b) => a.localeCompare(b, "ja")),
    organizationUnits,
  };
}

export async function createDocument(
  input: DocumentInput,
  context: MutationContext,
): Promise<DocumentSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);

  const documentId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    await assertOrganizationBelongsToTenant(
      tx,
      tenant.id,
      input.organizationUnitId,
    );

    const document = await tx.document.create({
      data: {
        tenantId: tenant.id,
        organizationUnitId: input.organizationUnitId,
        uploadedById: context.actorUserId,
        title: input.title,
        category: input.category,
        version: input.version,
        status: input.status,
        storageKey: input.storageKey,
        retentionUntil: input.retentionUntil
          ? new Date(input.retentionUntil)
          : null,
      },
      select: {
        id: true,
      },
    });

    await createDocumentVersion(tx, {
      tenantId: tenant.id,
      documentId: document.id,
      input,
      actorUserId: context.actorUserId,
      changeNote: "文書を登録",
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "文書を登録",
      targetType: "document",
      targetId: document.id,
      severity: AuditSeverity.NOTICE,
      metadata: {
        title: input.title,
        category: input.category,
        version: input.version,
        status: input.status,
        organizationUnitId: input.organizationUnitId,
      },
    });

    return document.id;
  });

  return getDocumentSummary(tenant.id, documentId);
}

export async function updateDocument(
  documentId: string,
  input: DocumentInput,
  context: MutationContext,
): Promise<DocumentSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);

  const updatedDocumentId = await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);
    const existingDocument = await tx.document.findFirst({
      where: {
        id: documentId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        title: true,
        category: true,
        version: true,
        status: true,
        storageKey: true,
        retentionUntil: true,
        organizationUnitId: true,
      },
    });

    if (!existingDocument) {
      throw new DocumentApplicationError(
        "DOCUMENT_NOT_FOUND",
        "指定された文書が見つかりません。",
        404,
      );
    }

    await assertOrganizationBelongsToTenant(
      tx,
      tenant.id,
      input.organizationUnitId,
    );

    await tx.document.update({
      where: { id: documentId },
      data: {
        organizationUnitId: input.organizationUnitId,
        title: input.title,
        category: input.category,
        version: input.version,
        status: input.status,
        storageKey: input.storageKey,
        retentionUntil: input.retentionUntil
          ? new Date(input.retentionUntil)
          : null,
      },
    });

    await createDocumentVersion(tx, {
      tenantId: tenant.id,
      documentId,
      input,
      actorUserId: context.actorUserId,
      changeNote: createDocumentChangeNote(existingDocument, input),
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "文書を更新",
      targetType: "document",
      targetId: documentId,
      severity: AuditSeverity.NOTICE,
      metadata: {
        title: input.title,
        category: input.category,
        version: input.version,
        status: input.status,
        organizationUnitId: input.organizationUnitId,
      },
    });

    return documentId;
  });

  return getDocumentSummary(tenant.id, updatedDocumentId);
}

export async function deleteDocument(
  documentId: string,
  context: MutationContext,
) {
  const tenant = await getTenantOrThrow(context.tenantCode);

  await prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);

    const existingDocument = await tx.document.findFirst({
      where: {
        id: documentId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        title: true,
        category: true,
        version: true,
        status: true,
        organizationUnitId: true,
      },
    });

    if (!existingDocument) {
      throw new DocumentApplicationError(
        "DOCUMENT_NOT_FOUND",
        "指定された文書が見つかりません。",
        404,
      );
    }

    await tx.document.delete({
      where: { id: documentId },
    });

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "文書を削除",
      targetType: "document",
      targetId: documentId,
      severity: AuditSeverity.WARNING,
      metadata: {
        title: existingDocument.title,
        category: existingDocument.category,
        version: existingDocument.version,
        status: existingDocument.status,
        organizationUnitId: existingDocument.organizationUnitId,
      },
    });
  });
}

export async function accessDocument(
  documentId: string,
  context: MutationContext,
): Promise<DocumentAccessSummary> {
  const tenant = await getTenantOrThrow(context.tenantCode);

  return prisma.$transaction(async (tx) => {
    await assertUserBelongsToTenant(tx, tenant.id, context.actorUserId);

    const document = await tx.document.findFirst({
      where: {
        id: documentId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        title: true,
        category: true,
        version: true,
        status: true,
        storageKey: true,
      },
    });

    if (!document) {
      throw new DocumentApplicationError(
        "DOCUMENT_NOT_FOUND",
        "指定された文書が見つかりません。",
        404,
      );
    }

    const accessedAt = new Date();

    await recordAuditEvent(tx, {
      tenantId: tenant.id,
      context,
      action: "文書にアクセス",
      targetType: "document",
      targetId: document.id,
      severity: AuditSeverity.INFO,
      metadata: {
        title: document.title,
        category: document.category,
        version: document.version,
        status: document.status,
        storageKey: document.storageKey,
      },
    });

    return {
      documentId: document.id,
      title: document.title,
      version: document.version,
      storageKey: document.storageKey,
      filename: getStorageFilename(document.storageKey),
      accessedAt: accessedAt.toISOString(),
    };
  });
}

async function getTenantOrThrow(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
  });

  if (!tenant) {
    throw new DocumentApplicationError(
      "TENANT_NOT_FOUND",
      `テナントが見つかりません: ${tenantCode}`,
      404,
    );
  }

  return tenant;
}

async function assertUserBelongsToTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
) {
  const uploader = await tx.user.findFirst({
    where: {
      tenantId,
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!uploader) {
    throw new DocumentApplicationError(
      "UPLOADER_NOT_FOUND",
      "文書を操作する利用者が見つかりません。",
      404,
    );
  }
}

async function findDocuments(tenantId: string) {
  return prisma.document.findMany({
    where: {
      tenantId,
    },
    include: {
      organizationUnit: true,
      uploadedBy: true,
      versions: {
        include: {
          organizationUnit: true,
          createdBy: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
  });
}

type DocumentRecord = Awaited<ReturnType<typeof findDocuments>>[number];

async function getDocumentSummary(
  tenantId: string,
  documentId: string,
): Promise<DocumentSummary> {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      tenantId,
    },
    include: {
      organizationUnit: true,
      uploadedBy: true,
      versions: {
        include: {
          organizationUnit: true,
          createdBy: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!document) {
    throw new DocumentApplicationError(
      "DOCUMENT_NOT_FOUND",
      "指定された文書が見つかりません。",
      404,
    );
  }

  return mapDocument(document);
}

function mapDocument(document: DocumentRecord): DocumentSummary {
  return {
    id: document.id,
    title: document.title,
    category: document.category,
    version: document.version,
    status: document.status,
    statusLabel: getDocumentStatusLabel(document.status),
    tone: getDocumentTone(document.status),
    storageKey: document.storageKey,
    retentionUntil: document.retentionUntil?.toISOString() ?? null,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    organizationUnit: document.organizationUnit
      ? {
          id: document.organizationUnit.id,
          name: document.organizationUnit.name,
        }
      : null,
    uploadedBy: {
      id: document.uploadedBy.id,
      name: document.uploadedBy.displayName,
    },
    versions: document.versions.map(mapDocumentVersion),
    versionCount: document.versions.length,
  };
}

function mapDocumentVersion(
  version: DocumentRecord["versions"][number],
): DocumentVersionSummary {
  return {
    id: version.id,
    title: version.title,
    category: version.category,
    version: version.version,
    status: version.status,
    statusLabel: getDocumentStatusLabel(version.status),
    tone: getDocumentTone(version.status),
    storageKey: version.storageKey,
    retentionUntil: version.retentionUntil?.toISOString() ?? null,
    changeNote: version.changeNote,
    createdAt: version.createdAt.toISOString(),
    organizationUnit: version.organizationUnit
      ? {
          id: version.organizationUnit.id,
          name: version.organizationUnit.name,
        }
      : null,
    createdBy: {
      id: version.createdBy.id,
      name: version.createdBy.displayName,
    },
  };
}

function createDocumentVersion(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    documentId: string;
    input: DocumentInput;
    actorUserId: string;
    changeNote: string;
  },
) {
  return tx.documentVersion.create({
    data: {
      tenantId: input.tenantId,
      documentId: input.documentId,
      organizationUnitId: input.input.organizationUnitId,
      createdById: input.actorUserId,
      title: input.input.title,
      category: input.input.category,
      version: input.input.version,
      status: input.input.status,
      storageKey: input.input.storageKey,
      retentionUntil: input.input.retentionUntil
        ? new Date(input.input.retentionUntil)
        : null,
      changeNote: input.changeNote,
    },
    select: {
      id: true,
    },
  });
}

function createDocumentChangeNote(
  before: {
    title: string;
    category: string;
    version: string;
    status: DocumentStatus;
    storageKey: string;
    retentionUntil: Date | null;
    organizationUnitId: string | null;
  },
  after: DocumentInput,
) {
  const changes: string[] = [];

  if (before.title !== after.title) {
    changes.push("文書名");
  }

  if (before.category !== after.category) {
    changes.push("分類");
  }

  if (before.version !== after.version) {
    changes.push(`版 ${before.version} -> ${after.version}`);
  }

  if (before.status !== after.status) {
    changes.push(`状態 ${getDocumentStatusLabel(before.status)} -> ${getDocumentStatusLabel(after.status)}`);
  }

  if (before.storageKey !== after.storageKey) {
    changes.push("保管キー");
  }

  if (formatDateKey(before.retentionUntil) !== formatDateKey(after.retentionUntil)) {
    changes.push("保管期限");
  }

  if (before.organizationUnitId !== after.organizationUnitId) {
    changes.push("管理組織");
  }

  return changes.length > 0 ? changes.join("、") : "履歴を記録";
}

async function assertOrganizationBelongsToTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
  organizationUnitId: string | null,
) {
  if (!organizationUnitId) {
    return;
  }

  const organizationUnit = await tx.organizationUnit.findFirst({
    where: {
      id: organizationUnitId,
      tenantId,
    },
    select: {
      id: true,
    },
  });

  if (!organizationUnit) {
    throw new DocumentApplicationError(
      "ORGANIZATION_UNIT_NOT_FOUND",
      "指定された組織が見つかりません。",
      404,
    );
  }
}

function getDocumentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    [DocumentStatus.DRAFT]: "下書き",
    [DocumentStatus.REVIEW]: "確認中",
    [DocumentStatus.ACTIVE]: "最新版",
    [DocumentStatus.ARCHIVED]: "保管済み",
  };

  return labels[status] ?? status;
}

function getDocumentTone(status: string): DocumentSummary["tone"] {
  if (status === DocumentStatus.ACTIVE) {
    return "open";
  }

  if (status === DocumentStatus.ARCHIVED) {
    return "busy";
  }

  return "wait";
}

function formatDateKey(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString().slice(0, 10);
}

function getStorageFilename(storageKey: string) {
  const segments = storageKey.split("/").filter(Boolean);

  return segments.at(-1) ?? storageKey;
}

export const prismaDocumentRepository = {
  getDocumentSnapshot,
  createDocument,
  updateDocument,
  deleteDocument,
  accessDocument,
} satisfies DocumentRepository;
