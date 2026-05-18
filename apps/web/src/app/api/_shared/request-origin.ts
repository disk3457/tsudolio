export function getRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost ?? request.headers.get("host")?.trim();

  if (!host) {
    return requestUrl.origin;
  }

  return `${forwardedProtocol ?? requestUrl.protocol.replace(":", "")}://${host}`;
}
