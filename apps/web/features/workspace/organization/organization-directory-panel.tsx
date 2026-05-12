import { Building2, Pencil, Trash2, UsersRound } from "lucide-react";
import { EmptyState } from "@/features/workspace/components/empty-state";
import type {
  OrganizationUnitSummary,
  UserSummary,
} from "@/lib/organization-types";
import type { ActivePanel, OrganizationLoadState } from "./types";

type OrganizationDirectoryPanelProps = {
  activePanel: ActivePanel;
  deletingId: string | null;
  onDeleteUnit: (unit: OrganizationUnitSummary) => void;
  onDeleteUser: (user: UserSummary) => void;
  onEditUnit: (unit: OrganizationUnitSummary) => void;
  onEditUser: (user: UserSummary) => void;
  organizationUnits: OrganizationUnitSummary[];
  status: OrganizationLoadState["status"];
  users: UserSummary[];
};

export function OrganizationDirectoryPanel({
  activePanel,
  deletingId,
  onDeleteUnit,
  onDeleteUser,
  onEditUnit,
  onEditUser,
  organizationUnits,
  status,
  users,
}: OrganizationDirectoryPanelProps) {
  const isUnitsPanel = activePanel === "units";

  return (
    <section className="panel widePanel" aria-labelledby="org-heading">
      <div className="panelHeader">
        <div>
          <p className="sectionLabel">{isUnitsPanel ? "組織階層" : "利用者"}</p>
          <h2 id="org-heading">{isUnitsPanel ? "組織一覧" : "利用者一覧"}</h2>
        </div>
        {isUnitsPanel ? (
          <Building2 aria-hidden="true" className="panelIcon" size={21} />
        ) : (
          <UsersRound aria-hidden="true" className="panelIcon" size={21} />
        )}
      </div>

      {status === "loading" && (
        <EmptyState title="取得中" description="組織データを確認しています。" />
      )}

      {status !== "loading" &&
        isUnitsPanel &&
        organizationUnits.length === 0 && (
          <EmptyState
            title="組織なし"
            description="登録済みの組織はまだありません。"
          />
        )}

      {status !== "loading" && !isUnitsPanel && users.length === 0 && (
        <EmptyState
          title="利用者なし"
          description="登録済みの利用者はまだありません。"
        />
      )}

      {isUnitsPanel && organizationUnits.length > 0 && (
        <OrganizationUnitList
          deletingId={deletingId}
          onDeleteUnit={onDeleteUnit}
          onEditUnit={onEditUnit}
          organizationUnits={organizationUnits}
        />
      )}

      {!isUnitsPanel && users.length > 0 && (
        <UserList
          deletingId={deletingId}
          onDeleteUser={onDeleteUser}
          onEditUser={onEditUser}
          users={users}
        />
      )}
    </section>
  );
}

type OrganizationUnitListProps = {
  deletingId: string | null;
  onDeleteUnit: (unit: OrganizationUnitSummary) => void;
  onEditUnit: (unit: OrganizationUnitSummary) => void;
  organizationUnits: OrganizationUnitSummary[];
};

function OrganizationUnitList({
  deletingId,
  onDeleteUnit,
  onEditUnit,
  organizationUnits,
}: OrganizationUnitListProps) {
  return (
    <div className="orgGrid">
      {organizationUnits.map((unit) => (
        <article className="orgCard" key={unit.id}>
          <div className="orgCardHeader">
            <span>{unit.kindLabel}</span>
            <strong>{unit.activeMemberCount}名</strong>
          </div>
          <h3>{unit.name}</h3>
          <p>
            {unit.parentName ?? "最上位"} / {unit.code}
          </p>
          <div className="orgCardMeta">
            <span>配下 {unit.childCount}</span>
            <span>施設 {unit.facilityCount}</span>
            <span>表示順 {unit.sortOrder}</span>
          </div>
          <div className="chipList">
            {unit.children.length > 0 ? (
              unit.children.map((child) => <span key={child.id}>{child.name}</span>)
            ) : (
              <span>配下なし</span>
            )}
          </div>
          <div className="eventActions">
            <button
              className="iconButton compact"
              aria-label={`${unit.name}を編集`}
              onClick={() => onEditUnit(unit)}
              type="button"
            >
              <Pencil aria-hidden="true" size={15} />
            </button>
            <button
              className="iconButton compact danger"
              aria-label={`${unit.name}を削除`}
              disabled={
                deletingId === unit.id ||
                unit.childCount > 0 ||
                unit.memberCount > 0 ||
                unit.facilityCount > 0
              }
              onClick={() => onDeleteUnit(unit)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

type UserListProps = {
  deletingId: string | null;
  onDeleteUser: (user: UserSummary) => void;
  onEditUser: (user: UserSummary) => void;
  users: UserSummary[];
};

function UserList({
  deletingId,
  onDeleteUser,
  onEditUser,
  users,
}: UserListProps) {
  return (
    <div className="recordList">
      {users.map((user) => (
        <article className="recordItem userRecord" key={user.id}>
          <div className="userRecordHeader">
            <div>
              <h3>{user.displayName}</h3>
              <p>{user.email}</p>
            </div>
            {user.isSystemAdmin && <span className="statusPill wait">管理者</span>}
          </div>
          <strong>{user.title ?? "役職未設定"}</strong>
          <div className="chipList compact">
            {user.memberships.length > 0 ? (
              user.memberships.map((membership) => (
                <span key={membership.id}>
                  {membership.organizationUnitName} / {membership.statusLabel}
                </span>
              ))
            ) : (
              <span>所属なし</span>
            )}
          </div>
          <div className="eventActions">
            <button
              className="iconButton compact"
              aria-label={`${user.displayName}を編集`}
              onClick={() => onEditUser(user)}
              type="button"
            >
              <Pencil aria-hidden="true" size={15} />
            </button>
            <button
              className="iconButton compact danger"
              aria-label={`${user.displayName}を利用停止`}
              disabled={deletingId === user.id}
              onClick={() => onDeleteUser(user)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
