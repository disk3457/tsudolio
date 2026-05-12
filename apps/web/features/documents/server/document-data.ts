import { prisma } from "@/lib/prisma";
import type {
  DocumentInput,
  DocumentSnapshot,
  DocumentSummary,
} from "@/features/documents/types";
import type { Prisma } from "@/generated/prisma/client";
import { DocumentStatus } from "@/generated/prisma/enums";

const defaultTenantCode = "demo-city-hospital";

export class DocumentDataError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "DocumentDataError";
  }
}

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
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
): Promise<DocumentSummary> {
  const tenant = await getTenantOrThrow(tenantCode);
  const uploader = await getDefaultUploader(tenant.id);

  const documentId = await prisma.$transaction(async (tx) => {
    await assertOrganizationBelongsToTenant(
      tx,
      tenant.id,
      input.organizationUnitId,
    );

    const document = await tx.document.create({
      data: {
        tenantId: tenant.id,
        organizationUnitId: input.organizationUnitId,
        uploadedById: uploader.id,
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
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
): Promise<DocumentSummary> {
  const tenant = await getTenantOrThrow(tenantCode);

  const updatedDocumentId = await prisma.$transaction(async (tx) => {
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
      throw new DocumentDataError(
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
  tenantCode = process.env.TSUDOLIO_TENANT_CODE ?? defaultTenantCode,
) {
  const tenant = await getTenantOrThrow(tenantCode);

  const existingDocument = await prisma.document.findFirst({
    where: {
      id: documentId,
      tenantId: tenant.id,
    },
    select: {
      id: true,
    },
  });

  if (!existingDocument) {
    throw new DocumentDataError(
      "DOCUMENT_NOT_FOUND",
      "指定された文書が見つかりません。",
      404,
    );
  }

  await prisma.document.delete({
    where: { id: documentId },
  });
}

async function getTenantOrThrow(tenantCode: string) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      code: tenantCode,
    },
  });

  if (!tenant) {
    throw new DocumentDataError(
      "TENANT_NOT_FOUND",
      `テナントが見つかりません: ${tenantCode}`,
      404,
    );
  }

  return tenant;
}

async function getDefaultUploader(tenantId: string) {
  const uploader = await prisma.user.findFirst({
    where: {
      tenantId,
    },
    orderBy: [{ isSystemAdmin: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
    },
  });

  if (!uploader) {
    throw new DocumentDataError(
      "UPLOADER_NOT_FOUND",
      "文書の登録者として使用できる利用者が見つかりません。",
      404,
    );
  }

  return uploader;
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
    throw new DocumentDataError(
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
    throw new DocumentDataError(
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
