/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { Route } from "next";

import { orgModules } from "@/lib/modules";

/**
 * Href for a docs page by slug. Doc slugs are data-driven (from `content/docs`),
 * so typed routes can't enumerate them — this is the one sanctioned cast. Lives
 * here, not in `@/lib/docs`, so client components can link to docs without
 * pulling the compiled `content-collections` corpus into the browser bundle.
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

/**
 * A top-level section of the end-user documentation. The taxonomy mirrors
 * `src/lib/modules.ts` — one section per org module that has a page — plus the
 * cross-cutting `getting-started` and `account` sections.
 *
 * A doc file declares which section it belongs to via its `section` frontmatter;
 * the value must be one of the ids here.
 */
export interface DocsSectionDef {
    /** Matches a `ModuleId`, or `getting-started` / `account`. */
    id: string;
    /** Heading shown in the docs sidebar. */
    title: string;
    /** Display order (ascending). */
    order: number;
}

export const docsSections: readonly DocsSectionDef[] = [
    { id: "getting-started", title: "Getting Started", order: 0 },
    ...orgModules.map((m, i) => ({ id: m.id, title: m.label, order: 10 + i })),
    { id: "account", title: "Your Account", order: 90 },
];

export const docsSectionById: Record<string, DocsSectionDef> = Object.fromEntries(
    docsSections.map((s) => [s.id, s]),
);
