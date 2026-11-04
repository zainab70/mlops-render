import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata: Metadata = { title: "Choose your password" };

/**
 * /change-password — no Figma frame (design decision, docs/roadmap.md#auth-004b): the same
 * centred .glass-card as /login, without sidebar or header. The root layout sends a user an
 * admin created here until they have chosen their own password (POST /me/password).
 */
export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-gradient-to-br from-[var(--ai-blue)]/5 via-transparent to-[var(--ai-purple)]/5 pointer-events-none"
      />
      <main className="relative z-10 w-full max-w-md glass-card rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[var(--ai-blue)] to-[var(--ai-purple)]">
            <KeyRound className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Choose your password</h1>
            <p className="text-sm text-muted-foreground">MLOps Hub</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          An admin created your account with a temporary password. Choose your
          own before you continue: at least 12 characters; a few unrelated words
          make a strong, easy-to-remember passphrase.
        </p>
        <ChangePasswordForm />
      </main>
    </div>
  );
}
