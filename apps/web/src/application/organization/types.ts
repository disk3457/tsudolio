export type OrganizationUnitKind =
  | "DEPARTMENT"
  | "WARD"
  | "BRANCH"
  | "TEAM"
  | "EXTERNAL_PARTNER";

export type MembershipStatus = "ACTIVE" | "INVITED" | "SUSPENDED" | "LEFT";

export type OrganizationOption = {
  id: string;
  name: string;
};

export type OrganizationUnitSummary = {
  id: string;
  code: string;
  name: string;
  kind: OrganizationUnitKind;
  kindLabel: string;
  parentId: string | null;
  parentName: string | null;
  path: string;
  sortOrder: number;
  memberCount: number;
  activeMemberCount: number;
  childCount: number;
  facilityCount: number;
  children: OrganizationOption[];
};

export type MembershipSummary = {
  id: string;
  organizationUnitId: string;
  organizationUnitName: string;
  status: MembershipStatus;
  statusLabel: string;
  roleIds: string[];
  roleNames: string[];
};

export type UserSummary = {
  id: string;
  email: string;
  displayName: string;
  kanaName: string | null;
  title: string | null;
  isSystemAdmin: boolean;
  passwordLoginEnabled: boolean;
  lastLoginAt: string | null;
  memberships: MembershipSummary[];
};

export type RoleSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  assignmentCount: number;
  permissionCount: number;
};

export type OrganizationSnapshot = {
  tenant: {
    code: string;
    name: string;
    timezone: string;
  };
  organizationUnits: OrganizationUnitSummary[];
  users: UserSummary[];
  roles: RoleSummary[];
};

export type OrganizationUnitInput = {
  code: string;
  name: string;
  kind: OrganizationUnitKind;
  parentId: string | null;
  sortOrder: number;
};

export type UserInput = {
  email: string;
  displayName: string;
  kanaName: string | null;
  title: string | null;
  organizationUnitId: string | null;
  isSystemAdmin: boolean;
  password: string | null;
  roleIds: string[];
};

export type OrganizationApiResponse =
  | {
      data: OrganizationSnapshot;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type OrganizationUnitMutationResponse =
  | {
      data: OrganizationUnitSummary;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type UserMutationResponse =
  | {
      data: UserSummary;
      source: "database";
    }
  | {
      error: string;
      message: string;
    };

export type DeleteMutationResponse =
  | {
      data: {
        id: string;
        deleted: boolean;
        suspended?: boolean;
      };
      source: "database";
    }
  | {
      error: string;
      message: string;
    };
