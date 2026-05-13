export function buildOrganizationUnitPath(
  parentPath: string | null,
  name: string,
) {
  return parentPath ? `${parentPath}/${name}` : `/${name}`;
}

export function isSameOrDescendantPath(
  candidatePath: string,
  ancestorPath: string,
) {
  return (
    candidatePath === ancestorPath ||
    candidatePath.startsWith(`${ancestorPath}/`)
  );
}
