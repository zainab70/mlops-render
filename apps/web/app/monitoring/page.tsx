import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Monitoring } from "@/components/monitoring/Monitoring";
import { SESSION_COOKIE } from "@/lib/api/config";
import { getMonitoring } from "@/lib/api/monitoring";

export const metadata: Metadata = { title: "Monitoring" };

/**
 * Monitoring (route `/monitoring`), docs/figma/monitoring.md. A server component: GET /monitoring is
 * fetched here with the session cookie, so the numbers arrive with the HTML; only the charts run in
 * the browser.
 */
export default async function MonitoringPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const monitoring = await getMonitoring(token);
  return <Monitoring monitoring={monitoring} />;
}
