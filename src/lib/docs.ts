/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Read model over the compiled `docs` content collection: the sidebar nav tree,
 * slug lookup, and adjacent-page helpers. Pure data — safe to import from
 * server components and route handlers (no `server-only` deps).
 */

import type { Route } from "next";

import { allDocs, type Doc } from "content-collections";

import { docsSections } from "@/lib/docs-sections";

export type { Doc };

/**
 * Href for a docs page by slug. Doc slugs are data-driven (from `content/docs`),
 * so typed routes can't enumerate them — this is the one sanctioned cast.
 */
export function docsHref(slug: string): Route {
    return (slug === "" ? "/docs" : `/docs/${slug}`) as Route;
}

/** A single page within a section of the docs sidebar. */
export interface DocsNavPage {
    slug: string;
    title: string;
}

/** A section of the docs sidebar with its pages, in display order. */
export interface DocsNavSection {
    id: string;
    title: string;
    pages: DocsNavPage[];
}

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
