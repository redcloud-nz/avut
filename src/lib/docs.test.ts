/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The docs sidebar tree: each section's `index.mdx` is its heading's link, never one of its pages.
 */

import { allDocs } from "content-collections";
import { describe, expect, it } from "vitest";

import { getDocsNav } from "./docs";

describe("getDocsNav", () => {
    const nav = getDocsNav();

    it("links every section's index page from its heading", () => {
        const indexSlugs = allDocs
            .filter((doc) => /(^|\/)index\.mdx$/.test(doc._meta.filePath) && doc.slug !== "")
            .map((doc) => doc.slug)
            .sort();

        expect(nav.flatMap((section) => section.indexSlug ?? []).sort()).toEqual(indexSlugs);
    });

    it("doesn't list a section's index page, or the docs home, among its pages", () => {
        for (const section of nav) {
            const slugs = section.pages.map((page) => page.slug);
            expect(slugs).not.toContain("");
            if (section.indexSlug !== undefined) expect(slugs).not.toContain(section.indexSlug);
        }
    });
});
