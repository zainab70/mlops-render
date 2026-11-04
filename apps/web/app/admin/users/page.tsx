import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { listUsers } from "@/lib/api/admin";
import { SESSION_COOKIE } from "@/lib/api/config";
import { roleLabel } from "@/components/shell/UserChip";
import { CreateUserForm } from "./CreateUserForm";

export const metadata: Metadata = { title: "Users" };

/**
 * /admin/users — admin only. No Figma frame (design decision, docs/roadmap.md#auth-003):
 * the shell + .glass-card. The API decides the role; a 403 shows "Not allowed".
 */
export default async function UsersPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const result = await listUsers(token);

  if (result.kind === "forbidden") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card rounded-2xl p-6 max-w-md text-center">
          <div className="p-3 rounded-xl bg-[var(--status-error)]/20 w-fit mx-auto mb-4">
            <ShieldAlert
              className="w-12 h-12 text-[var(--status-error)]"
              aria-hidden="true"
            />
          </div>
          <h1 className="text-3xl font-semibold mb-2">403 · Not allowed</h1>
          <p className="text-muted-foreground mb-6">
            Only admins can manage users.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--ai-blue)] to-[var(--ai-purple)] text-white hover:scale-105 transition-transform"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Users</h1>

      <section
        className="glass-card rounded-2xl p-6"
        aria-labelledby="new-user"
      >
        <h2 id="new-user" className="text-xl font-semibold mb-4">
          Create user
        </h2>
        <CreateUserForm />
      </section>

      <section
        className="glass-card rounded-2xl p-6"
        aria-labelledby="all-users"
      >
        <h2 id="all-users" className="text-xl font-semibold mb-4">
          All users ({result.users.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="users-table">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {result.users.map((user) => (
                <tr key={user.id} className="border-t border-border/50">
                  <td className="py-2 pr-4">{user.name}</td>
                  <td className="py-2 pr-4">{user.email}</td>
                  <td className="py-2">{roleLabel(user.role)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
