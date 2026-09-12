/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs/help/[...slug]
 *
 * Serves the compiled MDX for one doc page so the in-app `?help=<slug>` sheet
 * (`src/components/docs/help-sheet.tsx`) can render the same content the public
 * `/docs/<slug>` page shows. Respects flag-hidden sections.
 */

import { getVisibleDocBySlug } from "@/server/docs";

export interface DocsHelpPayload {
    slug: string;
    title: string;
    description: string | null;
    /** Bundled MDX module code — render with `<MDXContent code={...} />`. */
    code: string;
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
        code: doc.mdx,
    };
    return Response.json(payload);
}
