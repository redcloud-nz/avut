/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs/help/[...slug]
 *
 * Serves one help card (`content/help/**`) for the in-app `?help=<id>` sheet
 * (`src/components/docs/help-sheet.tsx`): its compiled MDX, key terms, and a
 * link to the full guide. The path segments are the card id. Respects
 * flag-hidden sections.
 */

import type { Route } from "next";

import { docsHref } from "@/lib/docs";
import { syntheticChecksFlag } from "@/lib/flags";
import { getVisibleHelpCard } from "@/server/docs";

export interface HelpCardPayload {
    id: string;
    title: string;
    /** Bundled MDX module code for the card body — render with `<MDXContent code={...} />`. */
    code: string;
    /** Glossary slugs to render in a `<KeyTerms>` callout after the body. */
    keyTerms: string[];
    /** The full guide, with its `#anchor` when the card names one. */
    guideHref: Route;
    /** Mirrors `syntheticChecksFlag` — feeds `<DocsFlagsProvider>` around the rendered MDX. */
    syntheticChecksEnabled: boolean;
}

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string[] }> }) {
    const { slug } = await ctx.params;
    const card = await getVisibleHelpCard(slug.join("/"));

    if (!card) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }

    const payload: HelpCardPayload = {
        id: card.id,
        title: card.title,
        code: card.code,
        keyTerms: card.keyTerms,
        guideHref: (docsHref(card.guideSlug) +
            (card.guideAnchor ? `#${card.guideAnchor}` : "")) as Route,
        syntheticChecksEnabled: await syntheticChecksFlag(),
    };
    return Response.json(payload);
}
