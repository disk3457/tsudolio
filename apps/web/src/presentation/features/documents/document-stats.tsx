type DocumentStatsProps = {
  activeCount: number;
  documentCount: number;
  reviewCount: number;
  versionCount: number;
};

export function DocumentStats({
  activeCount,
  documentCount,
  reviewCount,
  versionCount,
}: DocumentStatsProps) {
  return (
    <section className="statusStrip organizationStats" aria-label="文書概要">
      <div>
        <p className="metricLabel">文書</p>
        <strong>{documentCount}</strong>
      </div>
      <div>
        <p className="metricLabel">最新版</p>
        <strong>{activeCount}</strong>
      </div>
      <div>
        <p className="metricLabel">確認中</p>
        <strong>{reviewCount}</strong>
      </div>
      <div>
        <p className="metricLabel">履歴</p>
        <strong>{versionCount}</strong>
      </div>
    </section>
  );
}
