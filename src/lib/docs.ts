/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Read model over the compiled `docs` content collection: the sidebar nav tree,
 * slug lookup, and adjacent-page helpers. Pure data — safe to import from
 * server components and route handlers (no `server-only` deps).
 */

import { allDocs, type Doc } from "content-collections";

import { docsSections, type DocsNavPage, type DocsNavSection } from "@/lib/docs-sections";

export type { Doc };
export { docsHref } from "@/lib/docs-sections";
export type { DocsNavPage, DocsNavSection };

function byOrderThenTitle(a: Doc, b: Doc): number {
    return a.order - b.order || a.title.localeCompare(b.title);
}

/**
 * The docs sidebar tree: every configured section that has at least one page,
 * in section order, each with its pages in `order` then title order.
 *
 * A section's own `index.mdx` is the section landing page (linked from the
 * section heading) and is not listed as a child page.
 */
export function getDocsNav(): DocsNavSection[] {
    return docsSections
        .map((section) => ({
            id: section.id,
            title: section.title,
            pages: allDocs
                .filter((d) => d.section === section.id && !d.isSectionIndex)
                .sort(byOrderThenTitle)
                .map((d) => ({ slug: d.slug, title: d.title })),
        }))
        .filter((section) => section.pages.length > 0);
}

/** Look up a doc by its URL slug (`""` is the docs home). */
export function getDocBySlug(slug: string): Doc | undefined {
    return allDocs.find((d) => d.slug === slug);
}

/** Every slug that should be statically generated, including the `""` home. */
export function getAllDocSlugs(): string[] {
    return allDocs.map((d) => d.slug);
}
