import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Markdown, parseBlocks } from "./markdown";

describe("markdown", () => {
  it("parses paragraphs and lists", () => {
    const blocks = parseBlocks("Hello\n\n- one\n- two\n\n1. a\n2. b\nDone");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "ul", "ol", "p"]);
  });
  it("renders bold, italic and code", () => {
    const html = renderToStaticMarkup(<Markdown text="**Bold** and *it* and `x`" />);
    expect(html).toContain("<strong");
    expect(html).toContain("<em>it</em>");
    expect(html).toContain("<code");
  });
  it("keeps closed markers intact", () => {
    const html = renderToStaticMarkup(
      <Markdown text="- **9 hot leads** worth it. Start with *Send docs*." />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("<em>Send docs</em>");
    expect(html).not.toContain("*");
  });
  it("hides dangling markers while streaming", () => {
    const html = renderToStaticMarkup(<Markdown text="- **7 tasks** and *start with Send" />);
    expect(html).not.toContain("*");
    expect(html).toContain("start with Send");
    const partial = renderToStaticMarkup(<Markdown text="- **7 tasks due" />);
    expect(partial).not.toContain("**");
    expect(partial).toContain("7 tasks due");
  });
});
