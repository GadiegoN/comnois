import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, className = "", ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-medium text-fg-secondary">{label}</label>
      )}
      <input
        className={`w-full rounded-xl bg-inset border border-border-subtle px-3.5 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all ${className}`}
        {...props}
      />
      {hint && <p className="text-[11px] text-fg-muted">{hint}</p>}
    </div>
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = "", children, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-medium text-fg-secondary">{label}</label>
      )}
      <select
        className={`w-full rounded-xl bg-inset border border-border-subtle px-3 py-2 text-sm text-fg focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = "", ...props }: TextareaProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-medium text-fg-secondary">{label}</label>
      )}
      <textarea
        className={`w-full rounded-xl bg-inset border border-border-subtle px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all ${className}`}
        {...props}
      />
    </div>
  );
}

