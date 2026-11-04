import React from "react";
import type { WikiLinkReferenceInfo } from "@/types/platform";

interface MarkdownReaderProps {
  content: string;
  onTextSelect?: () => void;
  outboundLinks?: WikiLinkReferenceInfo[];
  onOpenNode?: (id: string) => void;
}

function renderInlineFormatting(
  text: string,
  outboundLinks?: WikiLinkReferenceInfo[],
  onOpenNode?: (id: string) => void
): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g);
  return parts.map((part, idx) => {
    if (part.startsWith("[[") && part.endsWith("]]") && part.length > 4) {
      const inner = part.slice(2, -2);
      const targetTitle = (inner.includes("|") ? inner.split("|")[0] : inner).trim();
      const displayLabel = (inner.includes("|") ? inner.split("|")[1] : inner).trim();
      const resolved = outboundLinks?.find(
        (lnk) =>
          lnk.title.toLowerCase() === targetTitle.toLowerCase() ||
          lnk.title.toLowerCase().includes(targetTitle.toLowerCase())
      );

      if (resolved && onOpenNode) {
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onOpenNode(resolved.id)}
            title={`Abrir nó conectado: ${resolved.title}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-brand-soft hover:bg-brand/20 border border-brand/40 text-xs font-semibold text-brand-text cursor-pointer transition"
          >
            <span>[[</span>
            <span className="underline decoration-dotted">{displayLabel}</span>
            <span>]]</span>
          </button>
        );
      }

      return (
        <span
          key={idx}
          title={`WikiLink para nó: ${inner}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-brand-soft border border-brand/30 text-xs font-semibold text-brand-text"
        >
          <span>[[</span>
          <span>{displayLabel}</span>
          <span>]]</span>
        </span>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded-md bg-elevated border border-border-subtle font-mono text-xs text-brand-text"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export function MarkdownReader({
  content,
  onTextSelect,
  outboundLinks,
  onOpenNode,
}: MarkdownReaderProps) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="my-3 p-3.5 rounded-xl bg-elevated border border-border-subtle font-mono text-xs text-fg overflow-x-auto"
          >
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      elements.push(<div key={`sp-${i}`} className="h-2" />);
      continue;
    }

    if (trimmed === "---") {
      elements.push(
        <hr key={`hr-${i}`} className="my-3 border-border-subtle" />
      );
      continue;
    }

    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1
          key={`h1-${i}`}
          className="text-base sm:text-lg font-extrabold text-fg mt-3 mb-1.5 tracking-tight"
        >
          {renderInlineFormatting(trimmed.slice(2), outboundLinks, onOpenNode)}
        </h1>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2
          key={`h2-${i}`}
          className="text-sm sm:text-base font-bold text-fg mt-3 mb-1 border-b border-border-subtle pb-1"
        >
          {renderInlineFormatting(trimmed.slice(3), outboundLinks, onOpenNode)}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3
          key={`h3-${i}`}
          className="text-xs sm:text-sm font-bold text-brand-text mt-2.5 mb-1"
        >
          {renderInlineFormatting(trimmed.slice(4), outboundLinks, onOpenNode)}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          key={`bq-${i}`}
          className="my-2 pl-3 border-l-2 border-brand italic text-xs sm:text-sm text-fg-secondary"
        >
          {renderInlineFormatting(trimmed.slice(2), outboundLinks, onOpenNode)}
        </blockquote>
      );
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div
          key={`li-${i}`}
          className="flex items-start gap-2 pl-2 text-xs sm:text-sm text-fg leading-relaxed"
        >
          <span className="text-brand-text font-bold mt-0.5">•</span>
          <div className="flex-1">
            {renderInlineFormatting(trimmed.slice(2), outboundLinks, onOpenNode)}
          </div>
        </div>
      );
      continue;
    }

    elements.push(
      <p
        key={`p-${i}`}
        className="text-xs sm:text-sm text-fg leading-relaxed"
      >
        {renderInlineFormatting(rawLine, outboundLinks, onOpenNode)}
      </p>
    );
  }

  return (
    <div
      onMouseUp={onTextSelect}
      title="Dica: selecione qualquer trecho com o mouse para preencher automaticamente um novo Destaque abaixo"
      className="rounded-2xl bg-inset border border-border-subtle p-5 max-h-96 overflow-y-auto space-y-1"
    >
      {elements}
    </div>
  );
}

