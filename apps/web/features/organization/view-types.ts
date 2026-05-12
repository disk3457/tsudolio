import type {
  OrganizationSnapshot,
  OrganizationUnitKind,
} from "@/features/organization/types";

export type OrganizationLoadState = {
  snapshot: OrganizationSnapshot | null;
  status: "loading" | "ready" | "error";
  message: string | null;
  updatedAt: string | null;
};

export type ActivePanel = "units" | "users";

export type UnitFormState = {
  id: string | null;
  code: string;
  name: string;
  kind: OrganizationUnitKind;
  parentId: string;
  sortOrder: string;
};

export type UserFormState = {
  id: string | null;
  email: string;
  displayName: string;
  kanaName: string;
  title: string;
  organizationUnitId: string;
  isSystemAdmin: boolean;
};
