import { KeyRound, UsersRound } from "lucide-react";
import {
  departments,
  roleAssignments,
} from "@/features/workspace/data/static-demo";

export function OrganizationView() {
  return (
    <section className="viewGrid">
      <section className="panel widePanel" aria-labelledby="org-heading">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">組織階層</p>
            <h2 id="org-heading">複数業種に対応する部門モデル</h2>
          </div>
          <UsersRound aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <div className="orgGrid">
          {departments.map((department) => (
            <article className="orgCard" key={department.name}>
              <div className="orgCardHeader">
                <span>{department.type}</span>
                <strong>{department.users}</strong>
              </div>
              <h3>{department.name}</h3>
              <p>{department.lead}</p>
              <div className="chipList">
                {department.children.map((child) => (
                  <span key={child}>{child}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="role-heading">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">権限</p>
            <h2 id="role-heading">ロール設計</h2>
          </div>
          <KeyRound aria-hidden="true" className="panelIcon" size={21} />
        </div>
        <div className="recordList">
          {roleAssignments.map((role) => (
            <article className="recordItem" key={role.role}>
              <div>
                <h3>{role.role}</h3>
                <p>{role.scope}</p>
              </div>
              <strong>{role.members}</strong>
              <span>{role.policy}</span>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
