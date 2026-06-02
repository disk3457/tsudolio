export type DocumentStatus = "DRAFT" | "REVIEW" | "ACTIVE" | "ARCHIVED";

export type DocumentOption = {
  id: string;
  name: string;
};

export type DocumentSummary = {
  id: string;
  title: string;
  category: string;
  version: string;
  status: DocumentStatus;
  statusLabel: string;
  tone: "open" | "busy" | "wait";
  storageKey: string;
  retentionUntil: string | null;
  createdAt: string;
  updatedAt: string;
  organizationUnit: DocumentOption | null;
  uploadedBy: DocumentOption;
  versions: DocumentVersionSummary[];
  versionCount: number;
};

export type DocumentVersionSummary = {
  id: string;
  title: string;
  category: string;
  version: string;
  status: DocumentStatus;
  statusLabel: string;
  tone: "open" | "busy" | "wait";
  storageKey: string;
  retentionUntil: string | null;
  changeNote: string | null;
  createdAt: string;
  organizationUnit: DocumentOption | null;
  createdBy: DocumentOption;
};

export type DocumentAccessSummary = {
  documentId: string;
  title: string;
  version: string;
  storageKey: string;
  filename: string;
  accessedAt: string;
};

export type DocumentSnapshot = {
  tenant: {
    code: string;
    name: string;
    timezone: string;
  };
  documents: DocumentSummary[];
  categories: string[];
  organizationUnits: DocumentOption[];
};

export type DocumentInput = {
  title: string;
  category: string;
  version: string;
  status: DocumentStatus;
  storageKey: string;
  retentionUntil: string | null;
  organizationUnitId: string | null;
};

export type DocumentsApiResponse =
  | {
      data: DocumentSnapshot;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type DocumentMutationResponse =
  | {
      data: DocumentSummary;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type DocumentAccessResponse =
  | {
      data: DocumentAccessSummary;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type DocumentDeleteResponse =
  | {
      data: {
        id: string;
        deleted: boolean;
      };
      source: "database";
    }
  | {
      error: string;
      message: string;
    };
