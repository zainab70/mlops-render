"use client";

import { Boxes } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, navItemsFor } from "./nav-items";

const linkBase = "flex items-center gap-3 px-4 py-3 rounded-xl transition-all";
const linkActive =
  "bg-gradient-to-r from-[var(--ai-blue)] to-[var(--ai-purple)] text-white shadow-lg";
const linkInactive =
  "text-muted-foreground hover:text-foreground hover:bg-accent";

/** Brand block shared by the sidebar and the mobile drawer. */
export function Brand() {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--ai-blue)] to-[var(--ai-purple)] flex items-center justify-center shadow-lg">
          <Boxes className="w-6 h-6 text-white" aria-hidden="true" />
        </div>
        <div>
          {/* The design uses <h1>; a <p> keeps one h1 per page (the page title). */}
          <p className="text-xl font-semibold">MLOps Hub</p>
          <p className="text-xs text-muted-foreground">v2.1.0</p>
        </div>
      </div>
    </div>
  );
}

type NavLinksProps = {
  /** Called after a link is clicked (the drawer uses it to close). */
  onNavigate?: () => void;
  /** Admins also see the admin links (e.g. Users). */
  isAdmin?: boolean;
};

/** Main navigation shared by the sidebar and the mobile drawer. */
export function NavLinks({ onNavigate, isAdmin = false }: NavLinksProps) {
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label="Main" className="flex-1 space-y-2">
      {navItemsFor(isAdmin).map(({ label, href, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`${linkBase} ${active ? linkActive : linkInactive}`}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar from the design (docs/figma/shell.md#sidebar). */
export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <aside className="w-64 h-screen sticky top-0 glass-card rounded-none border-r border-border/50 p-6 flex flex-col">
      <Brand />
      <NavLinks isAdmin={isAdmin} />

      <div className="mt-auto pt-6 border-t border-border">
        <div className="text-xs text-muted-foreground">
          <p>© 2026 MLOps Hub</p>
          <p className="mt-1">Production Ready</p>
        </div>
      </div>
    </aside>
  );
}
