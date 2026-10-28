import React from "react";

export type BadgeVariant =
  | "default"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-elevated text-fg-secondary border-border-subtle",
  brand: "bg-brand-soft text-brand-text border-brand/30",
  success: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30",
  danger: "bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/30",
  purple: "bg-purple-500/12 text-purple-700 dark:text-purple-300 border-purple-500/30",
  outline: "bg-transparent text-fg-secondary border-border-strong",
};

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${BADGE_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

