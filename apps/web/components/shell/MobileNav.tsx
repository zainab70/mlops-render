"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Brand, NavLinks } from "./Sidebar";

const DRAWER_ID = "mobile-drawer";

/**
 * Menu button + drawer below `md` (docs/figma/shell.md#mobile-menu-below-md).
 * The overlay and drawer are portalled to <body>: the header's glass-card uses
 * backdrop-filter, which would otherwise trap `position: fixed` inside it.
 */
export function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        className="md:hidden p-2 rounded-xl glass-card hover:scale-105 transition-transform"
      >
        {open ? (
          <X className="w-6 h-6" aria-hidden="true" />
        ) : (
          <Menu className="w-6 h-6" aria-hidden="true" />
        )}
      </button>

      {open &&
        createPortal(
          <>
            <div
              data-testid="mobile-overlay"
              aria-hidden="true"
              onClick={close}
              className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <div
              id={DRAWER_ID}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="md:hidden fixed top-0 left-0 bottom-0 w-64 glass-card border-r border-border/50 p-6 z-50 flex flex-col"
            >
              <Brand />
              <NavLinks onNavigate={close} isAdmin={isAdmin} />
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
