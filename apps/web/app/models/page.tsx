import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Models } from "@/components/models/Models";
import { SESSION_COOKIE } from "@/lib/api/config";
import { getModels } from "@/lib/api/models";

export const metadata: Metadata = { title: "Models" };

type PageProps = {
  searchParams: Promise<{ id?: string | string[] }>;
};

/**
 * Models (route `/models`), docs/figma/models.md. A server component: GET /models is fetched here
 * with the session cookie, so the cards arrive with the HTML. `?id=` (a SEARCH-002 result link)
 * highlights that version.
 */
export default async function ModelsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const id = Number(query.id);
  const highlightedId = Number.isInteger(id) && id > 0 ? id : null;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const registry = await getModels(token);

  return <Models registry={registry} highlightedId={highlightedId} />;
}
