/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs/search-index.json
 *
 * Search corpus for the docs site. The client fetches this once and queries it
 * in-browser with MiniSearch — no server-side search cost. Flag-hidden sections
 * are excluded, so the response varies by deployment environment.
 */

import { allDocs } from "content-collections";

import { docsSectionById } from "@/lib/docs-sections";
import { getVisibleDocSlugs } from "@/server/docs";

/** Rough plain-text extraction from an MDX body for indexing purposes. */
function toPlainText(mdx: string): string {
    return mdx
        .replace(/```[\s\S]*?```/g, " ") // fenced code
        .replace(/<[^>]+>/g, " ") // JSX tags
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> text
        .replace(/[#>*_`~|-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export interface DocsSearchRecord {
    id: string;
    slug: string;
    title: string;
    section: string;
    description: string;
    body: string;
}

export async function GET() {
    const visible = new Set(await getVisibleDocSlugs());

    const records: DocsSearchRecord[] = allDocs
        .filter((doc) => visible.has(doc.slug))
        .map((doc) => ({
            id: doc.slug,
            slug: doc.slug,
            title: doc.title,
            section: docsSectionById[doc.section]?.title ?? doc.section,
            description: doc.description ?? "",
            body: toPlainText(doc.content),
        }));

    return Response.json(records);
}
