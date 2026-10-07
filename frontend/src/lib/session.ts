/**
 * Browser session handling. The ROOK session token is kept in sessionStorage (cleared when the tab closes)
 * and sent as a Bearer header — never in URLs or cookies readable by other sites. See ADR-0007.
 */

const KEY = "rook.session";

export function getToken(): string | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.sessionStorage.setItem(KEY, token);
  } catch {
    /* storage unavailable (private mode): the user will be asked to sign in again */
  }
}

export function clearToken(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Only same-site relative paths, to prevent open redirects after sign-in. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}
