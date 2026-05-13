import { prisma } from "@/infrastructure/prisma/prisma-client";
import type { DocumentRepository } from "@/application/documents/use-cases";
import type {
  DocumentInput,
  DocumentSnapshot,
  DocumentSummary,
} from "@/application/documents/types";
import type { MutationContext } from "@/application/security/types";
import { DocumentApplicationError } from "@/application/documents/errors";
import type { Prisma } from "@generated/prisma/client";
import { DocumentStatus } from "@generated/prisma/enums";

const defaultTenantCode = "demo-city-hospital";

export async function getDocumentSnapshot(
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
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
  };
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

export const prismaDocumentRepository = {
  getDocumentSnapshot,
  createDocument,
  updateDocument,
  deleteDocument,
} satisfies DocumentRepository;
