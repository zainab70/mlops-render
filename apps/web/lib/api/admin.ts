import { apiUrl, SESSION_COOKIE } from "./config";

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
};

export type UsersResult =
  { kind: "ok"; users: AdminUser[] } | { kind: "forbidden" };

/**
 * GET /admin/users on the server, with the session cookie. The API decides the role:
 * 403 means "not an admin" (the page shows "Not allowed").
 */
export async function listUsers(
  sessionToken: string | undefined,
): Promise<UsersResult> {
  const response = await fetch(`${apiUrl()}/admin/users`, {
    headers: { cookie: `${SESSION_COOKIE}=${sessionToken ?? ""}` },
    cache: "no-store",
  });
  if (response.status === 403 || response.status === 401) {
    return { kind: "forbidden" };
  }
  if (!response.ok) {
    throw new Error(`GET /admin/users failed with HTTP ${response.status}`);
  }
  return { kind: "ok", users: (await response.json()) as AdminUser[] };
}

/** The API's error detail as one sentence (a string, or FastAPI's list of field errors). */
export function errorMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { loc?: unknown[]; msg?: string };
    const field = first.loc?.at(-1);
    return field ? `${String(field)}: ${first.msg}` : (first.msg ?? "Invalid");
  }
  return "Something went wrong. Please try again.";
}
