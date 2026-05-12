export function EmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="emptyState">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
