/**
 * Where the FastAPI service lives. Read from the environment variable API_URL
 * (by name only; locally in apps/web/.env.local, in CI/e2e set by the runner).
 * Used on the server only: the browser always calls the same-origin /api proxy.
 */
export function apiUrl(): string {
  const url = process.env.API_URL?.trim();
  if (!url) {
    throw new Error(
      "API_URL is not set. Add it to apps/web/.env.local, e.g. API_URL=http://localhost:8000",
    );
  }
  return url.replace(/\/+$/, "");
}

/** Must match COOKIE_NAME in services/api/auth.py (the web never imports backend code). */
export const SESSION_COOKIE = "mlops_session";
