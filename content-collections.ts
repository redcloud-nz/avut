/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * content-collections config — compiles the team-authored end-user docs in
 * `content/docs/**` to typed, MDX-rendered records. The `withContentCollections`
 * wrapper in `next.config.ts` runs this on `next dev` (watch) and `next build`.
 */

import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMDX } from "@content-collections/mdx";
import { z } from "zod";

/**
 * Turn a source file's path (relative to `content/docs`, without extension) into
 * the URL slug it is served at:
 *   `index`                 -> ``                    (/docs)
 *   `getting-started/index` -> `getting-started`     (/docs/getting-started)
 *   `i3/issuing-equipment`  -> `i3/issuing-equipment`
 */
function pathToSlug(metaPath: string): string {
    return metaPath.replace(/(^|\/)index$/, "");
}

/**
 * Split a doc's raw markdown into its opening block (heading + first
 * paragraph) and everything after, so the full `/docs/<slug>` page can render
 * the `<KeyTerms>` callout between them. Assumes the usual `# Title` followed
 * by a lead paragraph; a doc with fewer than two blocks has no "rest".
 */
function splitIntro(content: string): { intro: string; rest: string } {
    const blocks = content.split(/\n{2,}/);
    if (blocks.length <= 2) return { intro: content, rest: "" };
    const [heading, leadParagraph, ...remaining] = blocks;
    return { intro: `${heading}\n\n${leadParagraph}`, rest: remaining.join("\n\n") };
}

const docs = defineCollection({
    name: "docs",
    directory: "content/docs",
    include: "**/*.mdx",
    schema: z.object({
        content: z.string(),
        title: z.string(),
        description: z.string().optional(),
        /** Section id — mirrors a `ModuleId` from `src/lib/modules.ts`, or `getting-started` / `account`. */
        section: z.string(),
        /** Sort order within the section (section index pages should use 0). */
        order: z.number().default(100),
        /** Glossary slugs to show as a `<KeyTerms>` callout on this page. */
        keyTerms: z.array(z.string()).default([]),
    }),
    transform: async (doc, ctx) => {
        const mdx = await compileMDX(ctx, doc);
        const { intro, rest } = splitIntro(doc.content);
        const introMdx = await compileMDX(ctx, { ...doc, content: intro });
        const restMdx = rest ? await compileMDX(ctx, { ...doc, content: rest }) : null;
        const slug = pathToSlug(doc._meta.path);
        return {
            ...doc,
            mdx,
            introMdx,
            restMdx,
            slug,
            /** `true` for a section landing page (`<section>/index.mdx`). */
            isSectionIndex: doc._meta.path.endsWith("index") && slug !== "",
        };
    },
});

export default defineConfig({
    content: [docs],
});
