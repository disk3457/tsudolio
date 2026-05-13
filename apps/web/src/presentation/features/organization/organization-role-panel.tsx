import { KeyRound } from "lucide-react";
import type { OrganizationSnapshot } from "@/application/organization/types";

type OrganizationRolePanelProps = {
  roles: OrganizationSnapshot["roles"];
};

export function OrganizationRolePanel({ roles }: OrganizationRolePanelProps) {
  return (
    <section className="panel" aria-labelledby="role-heading">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">権限</p>
          <h2 id="role-heading">ロール</h2>
        </div>
        <KeyRound aria-hidden="true" className="panelIcon" size={21} />
      </div>
      <div className="recordList">
        {roles.map((role) => (
          <article className="recordItem" key={role.id}>
            <div>
              <h3>{role.name}</h3>
              <p>{role.code}</p>
            </div>
            <strong>{role.assignmentCount}件</strong>
            <span>
              {role.description ?? "説明未設定"} / 権限 {role.permissionCount}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
