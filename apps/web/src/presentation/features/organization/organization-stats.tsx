type OrganizationStatsProps = {
  activeUserCount: number;
  adminUserCount: number;
  organizationUnitCount: number;
  roleCount: number;
};

export function OrganizationStats({
  activeUserCount,
  adminUserCount,
  organizationUnitCount,
  roleCount,
}: OrganizationStatsProps) {
  return (
    <section className="statusStrip organizationStats" aria-label="組織概要">
      <div>
        <p className="metricLabel">組織</p>
        <strong>{organizationUnitCount}</strong>
      </div>
      <div>
        <p className="metricLabel">有効利用者</p>
        <strong>{activeUserCount}</strong>
      </div>
      <div>
        <p className="metricLabel">ロール</p>
        <strong>{roleCount}</strong>
      </div>
      <div>
        <p className="metricLabel">管理者</p>
        <strong>{adminUserCount}</strong>
      </div>
    </section>
  );
}
