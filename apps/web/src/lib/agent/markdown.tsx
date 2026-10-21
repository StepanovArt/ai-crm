import * as React from "react";

/**
 * Minimal, streaming-safe markdown: paragraphs, "-" / "1." lists, **bold**, *italic*, `code`.
 * Unclosed markers at the end of a streaming chunk are hidden instead of flashing as asterisks.
 */
const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g;

/** Drop an unmatched trailing marker (e.g. "**7 tasks" mid-stream) so it doesn't flash. */
function stripDangling(text: string): string {
  let out = text;
  const doubles = out.match(/\*\*/g)?.length ?? 0;
  if (doubles % 2 === 1) {
    const i = out.lastIndexOf("**");
    out = out.slice(0, i) + out.slice(i + 2);
  }
  const singles = out.replace(/\*\*/g, "").match(/\*/g)?.length ?? 0;
  if (singles % 2 === 1) {
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i] === "*" && out[i - 1] !== "*" && out[i + 1] !== "*") {
        out = out.slice(0, i) + out.slice(i + 1);
        break;
      }
    }
  }
  return out;
}

export function renderInline(text: string, keyPrefix = "i"): React.ReactNode[] {
  const cleaned = stripDangling(text);
  const parts = cleaned.split(INLINE).filter((p) => p !== "");
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**"))
      return (
        <strong key={key} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={key} className="rounded bg-muted px-1 font-mono text-[12px]">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={key}>{part.slice(1, -1)}</em>;
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    const bullet = /^\s*[-•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1]!);
      else blocks.push({ kind: "ul", items: [bullet[1]!] });
    } else if (numbered) {
      if (last?.kind === "ol") last.items.push(numbered[1]!);
      else blocks.push({ kind: "ol", items: [numbered[1]!] });
    } else if (line.trim() === "") {
      blocks.push({ kind: "p", lines: [] });
    } else if (last?.kind === "p") {
      last.lines.push(line);
    } else {
      blocks.push({ kind: "p", lines: [line] });
    }
  }
  return blocks.filter((b) => (b.kind === "p" ? b.lines.length > 0 : b.items.length > 0));
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.kind === "p")
          return (
            <p key={i} className="[&:not(:first-child)]:mt-2.5">
              {b.lines.map((l, j) => (
                <React.Fragment key={j}>
                  {j > 0 && <br />}
                  {renderInline(l, `${i}-${j}`)}
                </React.Fragment>
              ))}
            </p>
          );
        const List = b.kind === "ul" ? "ul" : "ol";
        return (
          <List
            key={i}
            className={`space-y-1.5 pl-5 [&:not(:first-child)]:mt-2.5 ${b.kind === "ul" ? "list-disc marker:text-muted-foreground/60" : "list-decimal marker:text-muted-foreground"}`}
          >
            {b.items.map((item, j) => (
              <li key={j} className="pl-0.5">
                {renderInline(item, `${i}-${j}`)}
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
