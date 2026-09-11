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
    }),
    transform: async (doc, ctx) => {
        const mdx = await compileMDX(ctx, doc);
        const slug = pathToSlug(doc._meta.path);
        return {
            ...doc,
            mdx,
            slug,
            /** `true` for a section landing page (`<section>/index.mdx`). */
            isSectionIndex: doc._meta.path.endsWith("index") && slug !== "",
        };
    },
});

export default defineConfig({
    content: [docs],
});
