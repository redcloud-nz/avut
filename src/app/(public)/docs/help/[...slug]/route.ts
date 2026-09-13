/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs/help/[...slug]
 *
 * Serves the compiled MDX for one doc page so the in-app `?help=<slug>` sheet
 * (`src/components/docs/help-sheet.tsx`) can render the same content the public
 * `/docs/<slug>` page shows — intro, `<KeyTerms>` callout, then the rest.
 * Respects flag-hidden sections.
 */

import { getVisibleDocBySlug } from "@/server/docs";

export interface DocsHelpPayload {
    slug: string;
    title: string;
    description: string | null;
    /** Bundled MDX module code for the intro — render with `<MDXContent code={...} />`. */
    introCode: string;
    /** Bundled MDX module code for the remainder, if any. */
    restCode: string | null;
    /** Glossary slugs to render in a `<KeyTerms>` callout between intro and rest. */
    keyTerms: string[];
}

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string[] }> }) {
    const { slug } = await ctx.params;
    const doc = await getVisibleDocBySlug(slug.join("/"));

    if (!doc) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }

    const payload: DocsHelpPayload = {
        slug: doc.slug,
        title: doc.title,
        description: doc.description ?? null,
        introCode: doc.introMdx,
        restCode: doc.restMdx,
        keyTerms: doc.keyTerms,
    };
    return Response.json(payload);
}
