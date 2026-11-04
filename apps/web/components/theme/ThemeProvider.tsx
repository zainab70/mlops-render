"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light (default) / dark theme, as in the design's ThemeContext:
 * class "light" or "dark" on <html>, saved in localStorage under "theme".
 * next-themes sets the class with an inline script before first paint,
 * so a stored dark theme never flashes light.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="theme"
    >
      {children}
    </NextThemesProvider>
  );
}
