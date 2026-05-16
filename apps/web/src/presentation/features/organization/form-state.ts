import type {
  OrganizationUnitInput,
  OrganizationUnitSummary,
  UserInput,
  UserSummary,
} from "@/application/organization/types";
import type { UnitFormState, UserFormState } from "./view-types";

export function createDefaultUnitFormState(): UnitFormState {
  return {
    id: null,
    code: "",
    name: "",
    kind: "DEPARTMENT",
    parentId: "",
    sortOrder: "0",
  };
}

export function createDefaultUserFormState(): UserFormState {
  return {
    id: null,
    email: "",
    displayName: "",
    kanaName: "",
    title: "",
    organizationUnitId: "",
    isSystemAdmin: false,
    password: "",
    roleIds: [],
  };
}

export function unitToFormState(unit: OrganizationUnitSummary): UnitFormState {
  return {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    kind: unit.kind,
    parentId: unit.parentId ?? "",
    sortOrder: String(unit.sortOrder),
  };
}

export function userToFormState(user: UserSummary): UserFormState {
  const primaryMembership =
    user.memberships.find((membership) => membership.status === "ACTIVE") ??
    user.memberships[0] ??
    null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    kanaName: user.kanaName ?? "",
    title: user.title ?? "",
    organizationUnitId: primaryMembership?.organizationUnitId ?? "",
    isSystemAdmin: user.isSystemAdmin,
    password: "",
    roleIds: primaryMembership?.roleIds ?? [],
  };
}

export function unitFormToInput(form: UnitFormState): OrganizationUnitInput {
  return {
    code: form.code,
    name: form.name,
    kind: form.kind,
    parentId: form.parentId || null,
    sortOrder: Number.parseInt(form.sortOrder || "0", 10),
  };
}

export function userFormToInput(form: UserFormState): UserInput {
  return {
    email: form.email,
    displayName: form.displayName,
    kanaName: form.kanaName || null,
    title: form.title || null,
    organizationUnitId: form.organizationUnitId || null,
    isSystemAdmin: form.isSystemAdmin,
    password: form.password || null,
    roleIds: form.roleIds,
  };
}
