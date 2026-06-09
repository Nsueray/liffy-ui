// Safe internal returnTo handling for login redirects (liffy-ui).

// Build "/login?returnTo=<current path+query>" so the user is sent back to the
// page they were on after a successful login. Never loops back to /login itself.
export function loginUrlWithReturnTo(): string {
  if (typeof window === "undefined") return "/login";
  if (window.location.pathname === "/login") return "/login";
  const here = window.location.pathname + window.location.search;
  return "/login?returnTo=" + encodeURIComponent(here);
}

// Validate a returnTo value before using it for navigation.
// Accept only same-origin internal absolute paths (single leading "/").
// Reject open-redirect vectors: "//evil.com", "https://…", "/\evil", non-internal.
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/")) return null; // must be internal absolute path
  if (decoded.startsWith("//")) return null; // protocol-relative → external
  if (decoded.startsWith("/\\")) return null; // backslash trick → external
  return decoded;
}
