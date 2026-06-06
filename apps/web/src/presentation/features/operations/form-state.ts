import type {
  TenantProfile,
  TenantProfileInput,
  TenantTypeValue,
} from "@/application/operations/types";

export type TenantProfileFormState = {
  name: string;
  displayName: string;
  type: TenantTypeValue;
  timezone: string;
};

export const tenantTypeOptions: Array<{
  label: string;
  value: TenantTypeValue;
}> = [
  { label: "自治体", value: "MUNICIPALITY" },
  { label: "病院", value: "HOSPITAL" },
  { label: "民間企業", value: "COMPANY" },
  { label: "複合組織", value: "HYBRID" },
];

export const timezoneOptions = [
  "Asia/Tokyo",
  "UTC",
  "America/New_York",
  "Europe/London",
  "Asia/Singapore",
  "Australia/Sydney",
];

export const defaultTenantProfileForm: TenantProfileFormState = {
  displayName: "",
  name: "",
  timezone: "Asia/Tokyo",
  type: "HYBRID",
};

export function tenantProfileToFormState(
  tenant: TenantProfile,
): TenantProfileFormState {
  return {
    displayName: tenant.displayName ?? "",
    name: tenant.name,
    timezone: tenant.timezone,
    type: tenant.type,
  };
}

export function tenantProfileFormToInput(
  form: TenantProfileFormState,
): TenantProfileInput {
  return {
    displayName: form.displayName.trim() || null,
    name: form.name.trim(),
    timezone: form.timezone,
    type: form.type,
  };
}
