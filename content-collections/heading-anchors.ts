/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Imported by `content-collections.ts` by relative path: the config bundler doesn't
 * resolve `@/` imports, so this file must not use them either.
 */

import GithubSlugger from "github-slugger";

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;

/**
 * Reduce a heading's inline markdown to the text `rehype-slug` sees (the
 * rendered element's text content): links and images keep only their text.
 * Emphasis and code markers (`*`, `` ` ``) are punctuation the slugger drops
 * anyway. Not handled, because no guide uses them: `_` emphasis (the slugger
 * keeps `_`), HTML entities (`&amp;`), setext headings, and headings nested in
 * a blockquote, list item or indented JSX block. Any of these would mismatch,
 * which the anchors test in `heading-anchors.test.ts` would catch.
 */
function headingText(raw: string): string {
    return raw.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
}

/**
 * The ids `rehype-slug` gives a document's headings, in document order: every
 * ATX heading (`#` to `######`) outside fenced code, slugged with one
 * `github-slugger` instance so repeated headings get `-1`, `-2`, … exactly as
 * rendered. Run over the whole document, not the intro/rest halves.
 */
export function headingAnchors(markdown: string): string[] {
    const slugger = new GithubSlugger();
    const anchors: string[] = [];
    let fence: string | null = null;

    for (const line of markdown.split("\n")) {
        const fenceMatch = FENCE.exec(line);
        if (fence) {
            if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length)
                fence = null;
            continue;
        }
        if (fenceMatch) {
            fence = fenceMatch[1];
            continue;
        }
        const heading = ATX_HEADING.exec(line);
        if (heading) anchors.push(slugger.slug(headingText(heading[1] ?? "")));
    }
    return anchors;
}
