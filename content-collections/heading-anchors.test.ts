/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { allDocs } from "content-collections";
import { describe, expect, it } from "vitest";

import { headingAnchors } from "./heading-anchors";

/**
 * The heading ids in esbuild's compiled MDX output, in order: `x.h2,{id:"…"`.
 * Matching the element keeps out other `id` props, like `<Screenshot id="…">`.
 */
function compiledHeadingIds(code: string): string[] {
    return [...code.matchAll(/\.h[1-6],\{id:"([^"]*)"/g)].map((match) => match[1]);
}

describe("headingAnchors", () => {
    it("slugs ATX headings in order, numbering repeats", () => {
        expect(
            headingAnchors("# Title\n\nText\n\n## 4. Record results\n\n## Notes\n\n### Notes"),
        ).toEqual(["title", "4-record-results", "notes", "notes-1"]);
    });

    it("skips headings inside fenced code", () => {
        expect(
            headingAnchors(
                "## Before\n\n```md\n# Not a heading\n```\n\n~~~\n## Nor this\n~~~\n\n## After",
            ),
        ).toEqual(["before", "after"]);
    });

    it("uses link text and drops closing hashes and code markers", () => {
        expect(headingAnchors("## See [the guide](/docs/x) ##\n\n## The `code` part")).toEqual([
            "see-the-guide",
            "the-code-part",
        ]);
    });

    it("ignores lines that aren't headings", () => {
        expect(headingAnchors("#hashtag\n\n    # indented code\n\nText # not a heading")).toEqual(
            [],
        );
    });
});

describe("doc anchors", () => {
    it.each(allDocs.map((doc) => [doc._meta.filePath, doc] as const))(
        "%s: anchors match the rendered heading ids",
        (_path, doc) => {
            const rendered = [
                ...compiledHeadingIds(doc.introMdx),
                ...(doc.restMdx ? compiledHeadingIds(doc.restMdx) : []),
            ];
            expect(rendered).toEqual(doc.anchors);
        },
    );

    it.each(allDocs.map((doc) => [doc._meta.filePath, doc] as const))(
        "%s: has no duplicate anchors",
        (_path, doc) => {
            expect(new Set(doc.anchors).size).toBe(doc.anchors.length);
        },
    );

    it("includes the numbered session steps", () => {
        const sessions = allDocs.find((doc) => doc.slug === "skill-track/sessions");
        expect(sessions?.anchors).toContain("4-record-results");
    });
});
