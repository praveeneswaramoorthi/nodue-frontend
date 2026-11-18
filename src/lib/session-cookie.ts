/**
 * session-cookie.ts
 *
 * Manages a lightweight, non-HttpOnly "nd_session" cookie set on the
 * *frontend* domain so that Next.js Edge Middleware can read it during
 * SSR/navigation without needing access to the HttpOnly access_token,
 * which lives on the backend domain (cross-origin, invisible to Vercel edge).
 *
 * This cookie carries ONLY the user role — never the JWT itself.
 * Actual authentication is still enforced by the HttpOnly access_token
 * on every backend API call.
 */

const SESSION_COOKIE = "nd_session";

/** Write `nd_session=<role>` on the current (frontend) domain. */
export function setSessionCookie(role: string): void {
  if (typeof document === "undefined") return;
  // 7 days – matches refresh token lifetime so mobile Safari doesn't expire early
  const maxAge = 7 * 24 * 60 * 60;
  const isHttps = typeof location !== "undefined" && location.protocol === "https:";
  const secure = isHttps ? "; Secure" : "";
  // SameSite=None + Secure is mandatory for cross-site / embedded / Safari ITP contexts, Lax for standard HTTP
  const sameSite = isHttps ? "; SameSite=None" : "; SameSite=Lax";
  document.cookie = `${SESSION_COOKIE}=${role}; path=/${sameSite}${secure}; max-age=${maxAge}`;
}

/** Remove the nd_session cookie. */
export function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  const isHttps = typeof location !== "undefined" && location.protocol === "https:";
  const secure = isHttps ? "; Secure" : "";
  const sameSite = isHttps ? "; SameSite=None" : "; SameSite=Lax";
  document.cookie = `${SESSION_COOKIE}=; path=/${sameSite}${secure}; max-age=0`;
}
