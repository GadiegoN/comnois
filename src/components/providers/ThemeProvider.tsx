"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { ThemeMode } from "@/types/platform";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  themes: Array<{
    id: ThemeMode;
    label: string;
    description: string;
    previewBg: string;
    previewAccent: string;
  }>;
}

const THEME_STORAGE_KEY = "comnois-theme";

export const AVAILABLE_THEMES: ThemeContextValue["themes"] = [
  {
    id: "light",
    label: "Alabaster",
    description: "Editorial claro de alto contraste",
    previewBg: "#f8fafc",
    previewAccent: "#4f46e5",
  },
  {
    id: "sepia",
    label: "Sépia",
    description: "Papel quente para leitura longa",
    previewBg: "#f5efe6",
    previewAccent: "#b45309",
  },
  {
    id: "dark",
    label: "Obsidian",
    description: "Escuro técnico profundo",
    previewBg: "#090d16",
    previewAccent: "#6366f1",
  },
  {
    id: "nord",
    label: "Aurora",
    description: "Ardósia nórdica suave",
    previewBg: "#18202c",
    previewAccent: "#0ea5e9",
  },
];

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => undefined,
  themes: AVAILABLE_THEMES,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (saved && ["light", "sepia", "dark", "nord"].includes(saved)) {
        setThemeState(saved);
        document.documentElement.setAttribute("data-theme", saved);
      } else {
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage errors in private mode
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: AVAILABLE_THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

