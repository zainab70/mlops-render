"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Ends the session on the server (POST /api/auth/logout) and goes to /login.
 * refresh() re-renders the root layout, which then drops the shell.
 */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      aria-label="Sign out"
      onClick={signOut}
      disabled={busy}
      className="p-2 rounded-xl glass-card hover:scale-105 transition-transform disabled:opacity-50"
    >
      <LogOut className="w-5 h-5 text-foreground" aria-hidden="true" />
    </button>
  );
}
