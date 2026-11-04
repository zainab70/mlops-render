import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SESSION_COOKIE } from "@/lib/api/config";
import { getCurrentUser } from "@/lib/api/me";
import { getUnreadCount } from "@/lib/api/notifications";
import { getModelTask, siteDescription } from "@/lib/api/task";
import "./globals.css";

/** The description names the served model's task (WEB-013), or "image classifier" without one. */
export async function generateMetadata(): Promise<Metadata> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return {
    title: { default: "MLOps Hub", template: "%s · MLOps Hub" },
    description: siteDescription(await getModelTask(token)),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // proxy.ts passes the path; it already sent requests without a cookie to /login.
  const pathname = (await headers()).get("x-pathname") ?? "/";
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await getCurrentUser(token);
  const onLogin = pathname === "/login";
  const onChangePassword = pathname === "/change-password";
  const mustChange = user?.must_change_password ?? false;

  // A cookie can exist but be expired or logged out: only the API knows.
  if (!user && !onLogin) redirect("/login");
  if (user && onLogin) redirect("/");
  // An admin-created user picks their own password first. Convenience only: the API
  // answers 403 "Password change required" to everything else anyway.
  if (mustChange && !onChangePassword) redirect("/change-password");
  if (user && !mustChange && onChangePassword) redirect("/");
  // Only the shell shows the bell; on page load, so the badge is in the first HTML.
  const showShell = user !== null && !mustChange;
  const unreadCount = showShell ? await getUnreadCount(token) : 0;

  return (
    // next-themes changes the class on <html> before React hydrates
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {user && showShell ? (
            <AppShell user={user} unreadCount={unreadCount}>
              {children}
            </AppShell>
          ) : (
            children
          )}
        </ThemeProvider>
      </body>
    </html>
  );
}
