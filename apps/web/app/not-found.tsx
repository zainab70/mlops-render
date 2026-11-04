import { AlertCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

/** 404 inside the shell (docs/figma/not-found.md). */
export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass-card rounded-2xl p-6 max-w-md text-center">
        <div className="p-3 rounded-xl bg-[var(--status-error)]/20 w-fit mx-auto mb-4">
          <AlertCircle
            className="w-12 h-12 text-[var(--status-error)]"
            aria-hidden="true"
          />
        </div>
        <h1 className="text-3xl font-semibold mb-2">404</h1>
        <p className="text-muted-foreground mb-6">Page not found</p>
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
