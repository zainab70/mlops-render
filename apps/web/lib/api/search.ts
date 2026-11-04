/**
 * Header search (SEARCH-002) against GET /search (SEARCH-001).
 * Runs in the browser, so it calls the same-origin proxy (/api/search) and the
 * session cookie goes along by itself; it never needs API_URL.
 */

export type SearchHit = { id: number; name: string };
export type ModelHit = SearchHit & { version: string; stage: string };

export type SearchResponse = {
  experiments: SearchHit[];
  models: ModelHit[];
  deployments: SearchHit[];
};

export type SearchKind = keyof SearchResponse;

/** One row of the results list, in the order the list shows them. */
export type SearchOption = {
  kind: SearchKind;
  id: number;
  name: string;
  /** Extra text that tells rows apart (a model's version). */
  detail?: string;
  href: string;
};

/** Must match MAX_QUERY_LENGTH in services/api/search.py. */
export const MAX_QUERY_LENGTH = 100;

export const GROUPS: { kind: SearchKind; title: string }[] = [
  { kind: "experiments", title: "Experiments" },
  { kind: "models", title: "Models" },
  { kind: "deployments", title: "Deployments" },
];

/** The section page a result opens; the id lets WEB-008/009/011 show that row. */
export function searchHref(kind: SearchKind, id: number): string {
  return `/${kind}?id=${id}`;
}

export async function fetchSearch(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`GET /search failed with HTTP ${response.status}`);
  }
  return (await response.json()) as SearchResponse;
}

/** All hits as one list: experiments, then models, then deployments. */
export function toOptions(results: SearchResponse): SearchOption[] {
  return GROUPS.flatMap(({ kind }) =>
    results[kind].map((hit) => ({
      kind,
      id: hit.id,
      name: hit.name,
      detail: "version" in hit ? `v${hit.version}` : undefined,
      href: searchHref(kind, hit.id),
    })),
  );
}
