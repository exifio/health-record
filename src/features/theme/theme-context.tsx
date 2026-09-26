"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

export type Theme = "system" | "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "health-record-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemPreference, setSystemPreference] = useState<"light" | "dark">("light");

  // Read initial stored theme safely
  useEffect(() => {
    let mounted = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "light" || stored === "dark" || stored === "system") {
        queueMicrotask(() => {
          if (mounted) setThemeState(stored);
        });
      }
    } catch {
      // Ignore localStorage errors
    }

    if (typeof window !== "undefined" && window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      queueMicrotask(() => {
        if (mounted) setSystemPreference(media.matches ? "dark" : "light");
      });

      const listener = (e: MediaQueryListEvent) => {
        setSystemPreference(e.matches ? "dark" : "light");
      };

      media.addEventListener("change", listener);
      return () => {
        mounted = false;
        media.removeEventListener("change", listener);
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? systemPreference : theme;

  // Apply to document element
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
      root.setAttribute("data-theme-mode", "system");
    } else {
      root.setAttribute("data-theme", theme);
      root.setAttribute("data-theme-mode", theme);
    }
  }, [theme, resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Ignore
    }
  };

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: "system",
      resolvedTheme: "light",
      setTheme: () => {},
    };
  }
  return context;
}
