import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { CurrentUser } from "@/lib/api/me";
import { HeaderSearch } from "./HeaderSearch";
import { NotificationsButton } from "./NotificationsButton";
import { SignOutButton } from "./SignOutButton";
import { UserChip } from "./UserChip";

type HeaderProps = {
  /** Mobile menu button, first in the row (the shell passes <MobileNav />). */
  menu?: React.ReactNode;
  /** Unread notifications on page load (GET /notifications/unread-count). */
  notificationCount?: number;
  /** The signed-in user (from GET /me); without one, no chip and no sign out. */
  user?: Pick<CurrentUser, "name" | "role">;
};

/** Top bar from the design (docs/figma/shell.md#header-topnavbar). */
export function Header({ menu, notificationCount, user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 glass-card border-b border-border/50 px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        {menu}

        <HeaderSearch />

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <NotificationsButton count={notificationCount} />
          {user && (
            <>
              <UserChip name={user.name} role={user.role} />
              <SignOutButton />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
