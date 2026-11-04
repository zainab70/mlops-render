"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  fetchSearch,
  MAX_QUERY_LENGTH,
  type SearchOption,
  toOptions,
} from "@/lib/api/search";
import { optionId, SearchResults, type SearchStatus } from "./SearchResults";

/** Wait this long after the last key press before asking the API. */
export const DEBOUNCE_MS = 250;

/**
 * The header search box (docs/figma/shell.md#header-topnavbar) wired to GET /search.
 * Typing waits DEBOUNCE_MS, then asks the API; each new query aborts the previous
 * request, so an older answer can never replace a newer one.
 */
export function HeaderSearch() {
  const router = useRouter();
  const listboxId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus | "idle">("idle");
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);

  // Ask the API once typing pauses. Cleanup runs on the next key press, which
  // cancels both the timer and a request still on its way.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await fetchSearch(trimmed, controller.signal);
        if (controller.signal.aborted) return;
        setOptions(toOptions(results));
        setStatus("results");
      } catch {
        if (controller.signal.aborted) return;
        setOptions([]);
        setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // A click anywhere outside the search box closes the list.
  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function onChange(value: string) {
    setQuery(value);
    setActiveIndex(-1);
    setOptions([]);
    if (value.trim()) {
      setStatus("loading");
      setOpen(true);
    } else {
      setStatus("idle");
      setOpen(false);
    }
  }

  function choose(option: SearchOption) {
    setOpen(false);
    setActiveIndex(-1);
    router.push(option.href);
  }

  const showList = open && status !== "idle";
  const listHasOptions = showList && status === "results" && options.length > 0;

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (status !== "results" || options.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        if (current === -1) return step === 1 ? 0 : options.length - 1;
        return (current + step + options.length) % options.length;
      });
      return;
    }
    if (event.key === "Enter" && listHasOptions) {
      event.preventDefault();
      choose(options[activeIndex >= 0 ? activeIndex : 0]);
    }
  }

  return (
    <div ref={boxRef} className="flex-1 max-w-xl relative">
      <label htmlFor="global-search" className="sr-only">
        Search
      </label>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        id="global-search"
        type="text"
        role="combobox"
        aria-expanded={listHasOptions}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          listHasOptions && activeIndex >= 0
            ? optionId(listboxId, activeIndex)
            : undefined
        }
        autoComplete="off"
        maxLength={MAX_QUERY_LENGTH}
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(query.trim() !== "")}
        placeholder="Search experiments, models, deployments..."
        className="w-full pl-10 pr-4 py-2 bg-accent/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--ai-blue)] transition-all"
      />
      {showList && (
        <SearchResults
          listboxId={listboxId}
          status={status}
          options={options}
          activeIndex={activeIndex}
          onChoose={choose}
        />
      )}
    </div>
  );
}
