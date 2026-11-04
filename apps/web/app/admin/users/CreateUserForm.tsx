"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/api/admin";

const inputClass =
  "w-full px-4 py-2 bg-accent/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--ai-blue)] transition-all";

/**
 * POST /api/admin/users (same-origin proxy). The API checks the role and the password
 * rules (NIST SP 800-63B); this form only shows what the API answers.
 */
export function CreateUserForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          role: form.get("role"),
          password: form.get("password"),
        }),
      });
      if (response.status === 201) {
        const user = (await response.json()) as { email: string };
        formElement.reset();
        setCreated(user.email);
        router.refresh(); // reload the list from the API
      } else {
        const body = (await response.json().catch(() => ({}))) as {
          detail?: unknown;
        };
        setError(errorMessage(body.detail));
      }
    } catch {
      setError("Cannot reach the server. Please try again.");
    }
    setBusy(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 md:grid-cols-2"
      noValidate
      aria-label="Create user"
    >
      <div className="space-y-1">
        <label htmlFor="new-name" className="text-sm font-medium">
          Name
        </label>
        <input id="new-name" name="name" required className={inputClass} />
      </div>
      <div className="space-y-1">
        <label htmlFor="new-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="new-email"
          name="email"
          type="email"
          autoComplete="off"
          required
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="new-role" className="text-sm font-medium">
          Role
        </label>
        <select
          id="new-role"
          name="role"
          defaultValue="ml_engineer"
          className={inputClass}
        >
          <option value="ml_engineer">ML Engineer</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="new-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby="password-rules"
          className={inputClass}
        />
        <p id="password-rules" className="text-xs text-muted-foreground">
          At least 12 characters. Long passphrases are welcome; common passwords
          are refused.
        </p>
      </div>

      <div className="md:col-span-2 space-y-3">
        {error && (
          <p
            role="alert"
            className="text-sm text-[var(--status-error)] bg-[var(--status-error)]/10 rounded-xl px-4 py-2"
          >
            {error}
          </p>
        )}
        {created && (
          <p
            role="status"
            className="text-sm text-[var(--status-success)] bg-[var(--status-success)]/10 rounded-xl px-4 py-2"
          >
            Created {created}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--ai-blue)] to-[var(--ai-purple)] text-white hover:scale-[1.02] transition-transform disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create user"}
        </button>
      </div>
    </form>
  );
}
