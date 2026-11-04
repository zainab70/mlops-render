"use client";

import { useEffect } from "react";

/**
 * Scrolls the highlighted deployment card (`?id=`, a SEARCH-002 result link) into view once the page
 * has loaded. The cards are server-rendered, so this is the only part that runs in the browser.
 */
export function ScrollToHighlighted({ id }: { id: number }) {
  useEffect(() => {
    const target = document.querySelector<HTMLElement>(
      '[data-testid="deployment-card"][aria-current="true"]',
    );
    // jsdom (unit tests) has no scrollIntoView.
    target?.scrollIntoView?.({ block: "center" });
  }, [id]);
  return null;
}
