import React from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success";

export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand hover:bg-brand-hover text-white shadow-sm border border-transparent",
  secondary:
    "bg-elevated hover:bg-inset text-fg border border-border-subtle",
  outline:
    "bg-surface hover:bg-elevated text-fg border border-border-strong",
  ghost:
    "bg-transparent hover:bg-elevated text-fg-secondary hover:text-fg border border-transparent",
  danger:
    "bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30",
  success:
    "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: "px-2.5 py-1 text-xs rounded-lg gap-1",
  sm: "px-3 py-1.5 text-xs rounded-xl gap-1.5",
  md: "px-4 py-2 text-sm rounded-xl gap-2",
  lg: "px-5 py-2.5 text-sm rounded-2xl gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

