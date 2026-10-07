import { load, loadBuffer } from "cheerio";
import type { AnyNode, Element } from "domhandler";

const SKIPPED = new Set(["script", "style"]);
const NOT_SHOWN = new Set(["template", "noscript"]);
const BLOCKS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "br",
  "caption",
  "dd",
  "details",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "option",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "td",
  "th",
  "tr",
  "ul",
]);
const DESCRIPTIONS = new Set(["description", "og:description", "twitter:description"]);
// Matched against an inline style attribute with spaces removed and lowercased.
const HIDING_STYLES = [
  /(^|;)display:none/,
  /(^|;)visibility:(hidden|collapse)/,
  /(^|;)opacity:(0+(\.0*)?|\.0+)(;|!|$)/,
  /(^|;)font-size:(0+(\.0*)?[a-z%]*|0?\.\d+px|1(\.0+)?px)(;|!|$)/,
  /(^|;)color:transparent/,
  /(^|;)(left|top|text-indent|margin-left|margin-top):-(\d{4,}|999)/,
];
const TINY_BOX = /(^|;)(width|height):(0[a-z%]*|1px)(;|!|$)/;

type Collected = { visible: string[]; hidden: string[] };

export type PageText = { visibleText: string; hiddenText: string; hasBodyText: boolean };

// Splits a page into the text customers see (title and body) and the text that's on the page but hidden from view:
// comments, hidden or invisible elements, <template> and <noscript> contents, image alt text and the meta description.
// Scripts and styles are left out. Hiding done with <style> blocks or CSS files isn't detected.
export function extractPageText(html: string | Buffer, contentType = ""): PageText {
  const charset = /charset=["']?([^;"'\s]+)/i.exec(contentType)?.[1];
  const $ =
    typeof html === "string"
      ? load(html, { scriptingEnabled: false })
      : loadBuffer(html, { scriptingEnabled: false, encoding: { transportLayerEncodingLabel: charset } });
  const title = $("head > title").text();
  $("head > title").remove();

  const collected: Collected = { visible: [], hidden: [] };
  walk($.root().toArray(), false, collected);
  const bodyText = tidy(collected.visible);
  return {
    visibleText: tidy([title, "\n", bodyText]),
    hiddenText: tidy(collected.hidden),
    hasBodyText: bodyText !== "",
  };
}

function walk(nodes: AnyNode[], hidden: boolean, out: Collected) {
  for (const node of nodes) {
    if (node.nodeType === 3) (hidden ? out.hidden : out.visible).push(node.data.replace(/\s+/g, " "));
    else if (node.nodeType === 8) out.hidden.push("\n", node.data, "\n");
    else if (node.nodeType === 9) walk(node.children, hidden, out);
    else if (node.nodeType === 1 && "attribs" in node) walkElement(node, hidden, out);
  }
}

function walkElement(element: Element, hidden: boolean, out: Collected) {
  const name = element.name.toLowerCase();
  if (SKIPPED.has(name)) return;
  if (name === "meta") {
    const kind = (element.attribs.name ?? element.attribs.property ?? "").toLowerCase();
    if (DESCRIPTIONS.has(kind) && element.attribs.content) out.hidden.push("\n", element.attribs.content, "\n");
    return;
  }
  if (name === "img" && element.attribs.alt) out.hidden.push("\n", element.attribs.alt, "\n");

  const hiddenInside = hidden || NOT_SHOWN.has(name) || hidesContent(element);
  // An inline hidden element mustn't split the visible text around it ("Guaran<span hidden></span>teed approval").
  const block = BLOCKS.has(name);
  const hiddenStarts = hiddenInside !== hidden;
  breakLine(out, block, hiddenStarts);
  walk(element.children, hiddenInside, out);
  breakLine(out, block, hiddenStarts);
}

function breakLine(out: Collected, block: boolean, hiddenStarts: boolean) {
  if (block) out.visible.push("\n");
  if (block || hiddenStarts) out.hidden.push("\n");
}

function hidesContent(element: Element): boolean {
  if ("hidden" in element.attribs) return true;
  const style = (element.attribs.style ?? "").toLowerCase().replace(/\s+/g, "");
  return (
    HIDING_STYLES.some((pattern) => pattern.test(style)) || (TINY_BOX.test(style) && style.includes("overflow:hidden"))
  );
}

function tidy(parts: string[]): string {
  return parts
    .join("")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
