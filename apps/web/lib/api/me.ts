import { apiUrl, SESSION_COOKIE } from "./config";

export type CurrentUser = {
  name: string;
  email: string;
  role: string;
  /** Set for users an admin created, until they choose their own password. */
  must_change_password: boolean;
};

/**
 * Asks the API who owns this session cookie (GET /me), server-side.
 * Returns null when there is no cookie or the API answers 401 (expired, logged out).
 */
export async function getCurrentUser(
  sessionToken: string | undefined,
): Promise<CurrentUser | null> {
  if (!sessionToken) return null;
  const response = await fetch(`${apiUrl()}/me`, {
    headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
    cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`GET /me failed with HTTP ${response.status}`);
  }
  return (await response.json()) as CurrentUser;
}
