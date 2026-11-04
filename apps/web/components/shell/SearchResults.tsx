import { GROUPS, type SearchOption } from "@/lib/api/search";

export type SearchStatus = "loading" | "results" | "error";

type SearchResultsProps = {
  /** id of the listbox; the input points at it with aria-controls. */
  listboxId: string;
  status: SearchStatus;
  options: SearchOption[];
  /** Index into options of the highlighted row, or -1. */
  activeIndex: number;
  onChoose: (option: SearchOption) => void;
};

export function optionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

/**
 * The header search dropdown (no Figma frame: a .glass-card under the input, SEARCH-002).
 * Results are one listbox with a group per type, so screen readers hear
 * "Experiments, group" before its options (WAI-ARIA combobox pattern).
 */
export function SearchResults({
  listboxId,
  status,
  options,
  activeIndex,
  onChoose,
}: SearchResultsProps) {
  const message =
    status === "loading"
      ? "Searching…"
      : status === "error"
        ? "Search is unavailable"
        : options.length === 0
          ? "No results"
          : null;

  return (
    <div className="absolute left-0 right-0 top-full mt-2 z-20 glass-card rounded-xl p-2 max-h-96 overflow-y-auto">
      {message ? (
        <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : (
        <div role="listbox" id={listboxId} aria-label="Search results">
          {GROUPS.map(({ kind, title }) => {
            const rows = options
              .map((option, index) => ({ option, index }))
              .filter(({ option }) => option.kind === kind);
            if (rows.length === 0) return null;
            const headingId = `${listboxId}-${kind}`;
            return (
              <div key={kind} role="group" aria-labelledby={headingId}>
                <div
                  id={headingId}
                  className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {title}
                </div>
                {rows.map(({ option, index }) => (
                  <div
                    key={option.href}
                    id={optionId(listboxId, index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    // mousedown would blur the input first; click is enough because
                    // the outside-click check ignores clicks inside the search box.
                    onClick={() => onChoose(option)}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                      index === activeIndex ? "bg-accent" : "hover:bg-accent/60"
                    }`}
                  >
                    <span className="truncate text-foreground">
                      {option.name}
                    </span>
                    {option.detail && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {option.detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
