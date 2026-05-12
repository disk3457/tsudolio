type DocumentStatsProps = {
  activeCount: number;
  categoryCount: number;
  documentCount: number;
  reviewCount: number;
};

export function DocumentStats({
  activeCount,
  categoryCount,
  documentCount,
  reviewCount,
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
        <p className="metricLabel">分類</p>
        <strong>{categoryCount}</strong>
      </div>
    </section>
  );
}
