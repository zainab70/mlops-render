import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Experiments } from "@/components/experiments/Experiments";
import { SESSION_COOKIE } from "@/lib/api/config";
import { getExperiment, getExperiments, isStatus } from "@/lib/api/experiments";

export const metadata: Metadata = { title: "Experiments" };

type PageProps = {
  searchParams: Promise<{ status?: string | string[]; id?: string | string[] }>;
};

/**
 * Experiments (route `/experiments`), docs/figma/experiments.md. A server component: the list
 * (with the ?status= filter), the unfiltered list for the chart and the ?id= row's details are
 * fetched here with the session cookie, so they arrive with the HTML. An unknown status shows all.
 */
export default async function ExperimentsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const status = isStatus(query.status) ? query.status : null;
  const id = Number(query.id);
  const selectedId = Number.isInteger(id) && id > 0 ? id : null;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const [list, all, details] = await Promise.all([
    getExperiments(token, status),
    status ? getExperiments(token, null) : null,
    selectedId === null ? null : getExperiment(token, selectedId),
  ]);
  const chart = all ?? list;

  return (
    <Experiments
      list={list}
      chartRows={chart.kind === "ok" ? chart.data : null}
      status={status}
      selected={
        selectedId === null || details === null
          ? null
          : { id: selectedId, details }
      }
    />
  );
}
