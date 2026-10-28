"use client";

import React from "react";
import { Sun, BookOpen, Moon, Sparkles } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import type { ThemeMode } from "@/types/platform";

const THEME_ICONS: Record<ThemeMode, React.ReactNode> = {
  light: <Sun className="w-3.5 h-3.5" />,
  sepia: <BookOpen className="w-3.5 h-3.5" />,
  dark: <Moon className="w-3.5 h-3.5" />,
  nord: <Sparkles className="w-3.5 h-3.5" />,
};

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl bg-inset p-1 border border-border-subtle"
      role="group"
      aria-label="Seletor de tema visual"
    >
      {themes.map((item) => {
        const active = theme === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setTheme(item.id)}
            title={`${item.label} — ${item.description}`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
              active
                ? "bg-surface text-brand-text shadow-sm border border-border-strong"
                : "text-fg-secondary hover:text-fg hover:bg-elevated/60 border border-transparent"
            }`}
          >
            {THEME_ICONS[item.id]}
            {!compact && <span>{item.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

