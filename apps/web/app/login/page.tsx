import { Boxes } from "lucide-react";
import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

/**
 * /login — no Figma frame (design decision, docs/roadmap.md#auth-002): a centred
 * .glass-card form with the WEB-002 tokens, on the shell's background, without sidebar or header.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-gradient-to-br from-[var(--ai-blue)]/5 via-transparent to-[var(--ai-purple)]/5 pointer-events-none"
      />
      <main className="relative z-10 w-full max-w-md glass-card rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[var(--ai-blue)] to-[var(--ai-purple)]">
            <Boxes className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">MLOps Hub</p>
          </div>
        </div>
        <LoginForm />
      </main>
    </div>
  );
}
