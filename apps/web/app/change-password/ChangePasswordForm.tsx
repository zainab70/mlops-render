"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "../login/PasswordField";

const inputClass =
  "w-full px-4 py-2 bg-accent/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--ai-blue)] transition-all";

const FIELDS = [
  {
    id: "current_password",
    label: "Temporary password",
    what: "temporary password",
    autoComplete: "current-password",
  },
  {
    id: "new_password",
    label: "New password",
    what: "new password",
    autoComplete: "new-password",
  },
  {
    id: "confirm_password",
    label: "Confirm new password",
    what: "confirmation",
    autoComplete: "new-password",
  },
] as const;

/** The API's own message ("at least 12 characters", "too common", …); it never contains the password. */
async function apiMessage(response: Response): Promise<string> {
  if (response.status === 400) return "The temporary password is wrong.";
  if (response.status === 429)
    return "Too many wrong attempts. Try again later.";
  try {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof body.detail === "string"
    ) {
      return body.detail;
    }
  } catch {
    // not JSON: fall through
  }
  return "Could not change the password. Please try again.";
}

/**
 * Posts the temporary and the new password to the API through the same-origin proxy
 * (/api/me/password). On success the API clears must_change_password, and refresh()
 * re-renders the root layout, which then shows the dashboard.
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("new_password") ?? "");
    if (newPassword !== String(form.get("confirm_password") ?? "")) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/me/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          current_password: form.get("current_password"),
          new_password: newPassword,
        }),
      });
      if (response.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      setError(await apiMessage(response));
    } catch {
      setError("Cannot reach the server. Please try again.");
    }
    setBusy(false);
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Choose your password"
      className="space-y-4"
      noValidate
    >
      {FIELDS.map((field) => (
        <div key={field.id} className="space-y-1">
          <label htmlFor={field.id} className="text-sm font-medium">
            {field.label}
          </label>
          <PasswordField
            id={field.id}
            what={field.what}
            autoComplete={field.autoComplete}
            className={inputClass}
          />
        </div>
      ))}

      {error && (
        <p
          role="alert"
          className="text-sm text-[var(--status-error)] bg-[var(--status-error)]/10 rounded-xl px-4 py-2"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--ai-blue)] to-[var(--ai-purple)] text-white hover:scale-[1.02] transition-transform disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save and continue"}
      </button>
      <button
        type="button"
        onClick={signOut}
        className="w-full px-6 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Sign out
      </button>
    </form>
  );
}
