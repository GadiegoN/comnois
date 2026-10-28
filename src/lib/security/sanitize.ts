import * as cheerio from "cheerio";

const FORBIDDEN_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "applet",
  "meta",
  "link",
  "style",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "base",
  "svg",
  "math",
];

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "article",
  "section",
  "div",
  "span",
]);

export function sanitizeHtmlContent(rawHtml: string): string {
  if (!rawHtml) return "";

  const $ = cheerio.load(rawHtml, null, false);

  for (const tag of FORBIDDEN_TAGS) {
    $(tag).remove();
  }

  $("*").each((_, el) => {
    if (el.type !== "tag") return;
    const tagName = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tagName)) {
      $(el).replaceWith($(el).contents());
      return;
    }

    const attribs = el.attribs ?? {};
    for (const attrName of Object.keys(attribs)) {
      const lowerAttr = attrName.toLowerCase();
      const attrVal = (attribs[attrName] ?? "").trim();

      if (lowerAttr.startsWith("on") || lowerAttr === "style" || lowerAttr === "srcdoc") {
        $(el).removeAttr(attrName);
        continue;
      }

      if (lowerAttr === "href" || lowerAttr === "src") {
        const cleanVal = attrVal.replace(/[\u0000-\u001F\u007F\s]+/g, "").toLowerCase();
        if (
          cleanVal.startsWith("javascript:") ||
          cleanVal.startsWith("vbscript:") ||
          cleanVal.startsWith("data:")
        ) {
          $(el).removeAttr(attrName);
          continue;
        }
      }

      if (tagName === "a" && lowerAttr === "href") {
        $(el).attr("rel", "noopener noreferrer nofollow");
        $(el).attr("target", "_blank");
      } else if (lowerAttr !== "title" && lowerAttr !== "alt") {
        $(el).removeAttr(attrName);
      }
    }
  });

  return $.html().trim();
}

export function escapePlainText(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

