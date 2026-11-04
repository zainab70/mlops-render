import { cookies } from "next/headers";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { SESSION_COOKIE } from "@/lib/api/config";
import { checkHealth, getDashboard } from "@/lib/api/dashboard";
import { getMonitoring } from "@/lib/api/monitoring";

/**
 * Dashboard (route `/`), docs/figma/dashboard.md. A server component: GET /dashboard and
 * GET /monitoring (with the session cookie) and GET /health are fetched here at the same time, so
 * the numbers arrive with the HTML; only the chart runs in the browser.
 */
export default async function DashboardPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const [dashboard, monitoring, health] = await Promise.all([
    getDashboard(token),
    getMonitoring(token),
    checkHealth(),
  ]);
  return (
    <Dashboard dashboard={dashboard} health={health} monitoring={monitoring} />
  );
}
