import { User } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  ml_engineer: "ML Engineer",
};

/** "ml_engineer" → "ML Engineer"; an unknown role is shown as it is. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** Signed-in user (docs/figma/shell.md, "3c. User chip"); hidden below md. */
export function UserChip({ name, role }: { name: string; role: string }) {
  return (
    <div
      data-testid="user-chip"
      className="hidden md:flex items-center gap-3 p-2 pl-3 rounded-xl glass-card hover:scale-105 transition-transform cursor-pointer"
    >
      <div className="text-right">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{roleLabel(role)}</p>
      </div>
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--ai-blue)] to-[var(--ai-purple)] flex items-center justify-center">
        <User className="w-5 h-5 text-white" aria-hidden="true" />
      </div>
    </div>
  );
}
