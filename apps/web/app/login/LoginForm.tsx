"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "./PasswordField";

const inputClass =
  "w-full px-4 py-2 bg-accent/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--ai-blue)] transition-all";

/** 429 = the API's failed-login lockout; Retry-After says for how many seconds. */
function failureMessage(response: Response): string {
  if (response.status === 401) return "Wrong email or password";
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after"));
    const minutes = Number.isFinite(seconds) ? Math.ceil(seconds / 60) : 0;
    const wait =
      minutes > 0 ? `in ${minutes} minute${minutes === 1 ? "" : "s"}` : "later";
    return `Too many failed sign-in attempts. Try again ${wait}.`;
  }
  return "Sign in failed. Please try again.";
}

/** The login answer says whether an admin-created user must first choose a password. */
async function mustChangePassword(response: Response): Promise<boolean> {
  try {
    const body: unknown = await response.json();
    return (
      typeof body === "object" &&
      body !== null &&
      "must_change_password" in body &&
      body.must_change_password === true
    );
  } catch {
    return false;
  }
}

/**
 * Posts email + password to the API through the same-origin proxy (/api/auth/login).
 * The API sets the httpOnly session cookie; this code never sees the token.
 */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      if (response.ok) {
        // Go straight to the right page: a layout redirect during a client-side
        // navigation leaves the page blank. refresh() re-renders the root layout.
        router.replace(
          (await mustChangePassword(response)) ? "/change-password" : "/",
        );
        router.refresh();
        return;
      }
      setError(failureMessage(response));
    } catch {
      setError("Cannot reach the server. Please try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <PasswordField className={inputClass} />
      </div>

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
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
