import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Deployments } from "@/components/deployments/Deployments";
import { highlightId } from "@/components/deployments/format";
import { SESSION_COOKIE } from "@/lib/api/config";
import { getDeployments } from "@/lib/api/deployments";

export const metadata: Metadata = { title: "Deployments" };

type PageProps = {
  searchParams: Promise<{ id?: string | string[] }>;
};

/**
 * Deployments (route `/deployments`), docs/figma/deployments.md. A server component: GET /deployments
 * is fetched here with the session cookie, so the numbers arrive with the HTML; only the charts run in
 * the browser. `?id=` (a SEARCH-002 result link) highlights that deployment's card.
 */
export default async function DeploymentsPage({ searchParams }: PageProps) {
  const highlightedId = highlightId((await searchParams).id);
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const deployments = await getDeployments(token);
  return (
    <Deployments deployments={deployments} highlightedId={highlightedId} />
  );
}
