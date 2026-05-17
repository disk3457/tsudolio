"use client";

import { AlertCircle } from "lucide-react";
import { OrganizationDirectoryPanel } from "@/presentation/features/organization/organization-directory-panel";
import {
  OrganizationUnitForm,
  UserForm,
} from "@/presentation/features/organization/organization-forms";
import { OrganizationRolePanel } from "@/presentation/features/organization/organization-role-panel";
import { OrganizationStats } from "@/presentation/features/organization/organization-stats";
import { OrganizationToolbar } from "@/presentation/features/organization/organization-toolbar";
import { useOrganizationDirectory } from "@/presentation/features/organization/use-organization-directory";

export function OrganizationView() {
  const {
    activePanel,
    activeUsers,
    adminUsers,
    closeUnitForm,
    closeUserForm,
    deletingId,
    formUnits,
    handleUnitDelete,
    handleUnitSubmit,
    handleUserDelete,
    handleUserSubmit,
    loadOrganization,
    openUnitForm,
    openUserForm,
    organizationState,
    organizationUnits,
    roles,
    saving,
    setActivePanel,
    unitForm,
    updateUnitForm,
    updateUserForm,
    userForm,
    users,
  } = useOrganizationDirectory();

  return (
    <section className="viewStack">
      <OrganizationToolbar
        activePanel={activePanel}
        onActivePanelChange={setActivePanel}
        onOpenUnitForm={() => openUnitForm()}
        onOpenUserForm={() => openUserForm()}
        onRefresh={() => void loadOrganization()}
      />

      {organizationState.message && (
        <div className="viewAlert" role="alert">
          <AlertCircle aria-hidden="true" size={18} />
          <p>{organizationState.message}</p>
        </div>
      )}

      <OrganizationUnitForm
        form={unitForm}
        formUnits={formUnits}
        onCancel={closeUnitForm}
        onSubmit={(event) => void handleUnitSubmit(event)}
        onUpdateField={updateUnitForm}
        saving={saving}
      />

      <UserForm
        form={userForm}
        organizationUnits={organizationUnits}
        roles={roles}
        onCancel={closeUserForm}
        onSubmit={(event) => void handleUserSubmit(event)}
        onUpdateField={updateUserForm}
        saving={saving}
      />

      <OrganizationStats
        activeUserCount={activeUsers.length}
        adminUserCount={adminUsers.length}
        organizationUnitCount={organizationUnits.length}
        roleCount={roles.length}
      />

      <section className="viewGrid">
        <OrganizationDirectoryPanel
          activePanel={activePanel}
          deletingId={deletingId}
          onDeleteUnit={(unit) => void handleUnitDelete(unit)}
          onDeleteUser={(user) => void handleUserDelete(user)}
          onEditUnit={openUnitForm}
          onEditUser={openUserForm}
          organizationUnits={organizationUnits}
          status={organizationState.status}
          users={users}
        />

        <OrganizationRolePanel roles={roles} />
      </section>
    </section>
  );
}
