import type { CurrentUser } from "@/lib/api/me";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

/** The layout every page renders in (docs/figma/shell.md#layout). */
export function AppShell({
  user,
  unreadCount = 0,
  children,
}: {
  user: CurrentUser;
  /** GET /notifications/unread-count, read by the root layout on page load. */
  unreadCount?: number;
  children: React.ReactNode;
}) {
  // Only hides the link; the API itself refuses admin routes for other roles (403).
  const isAdmin = user.role === "admin";

  return (
    <div className="flex min-h-screen bg-background relative">
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-gradient-to-br from-[var(--ai-blue)]/5 via-transparent to-[var(--ai-purple)]/5 pointer-events-none"
      />

      <div className="hidden md:block">
        <Sidebar isAdmin={isAdmin} />
      </div>

      <div className="flex-1 flex flex-col relative z-10">
        <Header
          menu={<MobileNav isAdmin={isAdmin} />}
          notificationCount={unreadCount}
          user={user}
        />
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
