import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const PADDING_CLASSES = {
  none: "",
  sm: "p-3.5",
  md: "p-5",
  lg: "p-6",
};

export function Card({
  interactive = false,
  selected = false,
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-surface border transition-all theme-card-shadow ${
        selected
          ? "border-brand ring-1 ring-brand/40"
          : interactive
            ? "border-border-subtle hover:border-border-strong cursor-pointer"
            : "border-border-subtle"
      } ${PADDING_CLASSES[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-start justify-between gap-3 mb-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-sm font-semibold text-fg flex items-center gap-2 ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-fg-secondary leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
}

