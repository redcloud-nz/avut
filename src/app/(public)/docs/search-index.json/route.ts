/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs/search-index.json
 *
 * Statically-built search corpus for the docs site. The client fetches this
 * once and queries it in-browser with MiniSearch — no server-side search cost.
 */

import { allDocs } from "content-collections";

import { docsSectionById } from "@/lib/docs-sections";

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

async function buildIndex(): Promise<DocsSearchRecord[]> {
    "use cache";

    return allDocs.map((doc) => ({
        id: doc.slug,
        slug: doc.slug,
        title: doc.title,
        section: docsSectionById[doc.section]?.title ?? doc.section,
        description: doc.description ?? "",
        body: toPlainText(doc.content),
    }));
}

export async function GET() {
    return Response.json(await buildIndex());
}
