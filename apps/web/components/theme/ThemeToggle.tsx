"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

// true in the browser after hydration, false during server rendering
const subscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/** Theme switch from the design (docs/figma/shell.md, "3a. Theme toggle"). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isClient = useIsClient();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2 rounded-xl glass-card hover:scale-105 transition-transform"
      aria-label="Toggle theme"
    >
      {/* The stored theme is only known in the browser; render an empty
          box of the same size on the server to avoid a wrong icon. */}
      {!isClient ? (
        <span className="block w-5 h-5" />
      ) : isDark ? (
        <Sun className="w-5 h-5 text-foreground" />
      ) : (
        <Moon className="w-5 h-5 text-foreground" />
      )}
    </button>
  );
}
