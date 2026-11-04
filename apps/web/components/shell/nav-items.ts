import {
  Activity,
  Boxes,
  FlaskConical,
  LayoutDashboard,
  Rocket,
  ScanLine,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };

/** The app's main navigation (docs/figma/shell.md#sidebar), in display order. */
export const navItems: readonly NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Experiments", href: "/experiments", icon: FlaskConical },
  { label: "Models", href: "/models", icon: Boxes },
  { label: "Monitoring", href: "/monitoring", icon: Activity },
  { label: "Deployments", href: "/deployments", icon: Rocket },
  // WEB-006: not in the Figma sidebar (no scan frame); added by human decision.
  { label: "Scan", href: "/scan", icon: ScanLine },
];

/** Admin-only links (AUTH-003; no Figma frame). The API refuses them for other roles too. */
export const adminNavItems: readonly NavItem[] = [
  { label: "Users", href: "/admin/users", icon: Users },
];

/** The links a user sees: the main navigation, plus the admin links for admins. */
export function navItemsFor(isAdmin: boolean): readonly NavItem[] {
  return isAdmin ? [...navItems, ...adminNavItems] : navItems;
}

/** "/" is active only on exactly "/"; other items also on their sub-paths. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
