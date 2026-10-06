/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * content-collections config — compiles the team-authored end-user docs in
 * `content/docs/**` and the "what's new" product-update entries in
 * `content/updates/*.mdx` to typed, MDX-rendered records. The `withContentCollections`
 * wrapper in `next.config.ts` runs this on `next dev` (watch) and `next build`.
 */

import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import * as z from "zod";

import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMDX } from "@content-collections/mdx";

import { headingAnchors } from "./content-collections/heading-anchors";

// GFM adds table syntax (among other things) — `docsMdxComponents` already
// styles `table`/`th`/`td`, so wire the plugin in to match.
const mdxOptions = { remarkPlugins: [remarkGfm] };

// Guides also get GitHub-style heading ids, so a link can target a section
// (`/docs/skill-track/sessions#4-record-results`). `updates` stays on
// `mdxOptions`: several entries render on one page, so their ids could collide.
const docsMdxOptions = { ...mdxOptions, rehypePlugins: [rehypeSlug] };

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
        const { intro, rest } = splitIntro(doc.content);
        const introMdx = await compileMDX(ctx, { ...doc, content: intro }, docsMdxOptions);
        const restMdx = rest
            ? await compileMDX(ctx, { ...doc, content: rest }, docsMdxOptions)
            : null;
        const slug = pathToSlug(doc._meta.path);
        return {
            ...doc,
            introMdx,
            restMdx,
            slug,
            /**
             * The ids `rehype-slug` gives this doc's headings, in order — the valid
             * `#anchor`s for a link into it. Computed over the whole document;
             * intro and rest are compiled separately, so a heading repeated
             * across the split would render the same id twice (the anchors test
             * guards against duplicates).
             */
            anchors: headingAnchors(doc.content),
            /** `true` for a section landing page (`<section>/index.mdx`). */
            isSectionIndex: doc._meta.path.endsWith("index") && slug !== "",
        };
    },
});

/**
 * In-app help cards for the `?help=<id>` sheet: a short note written for one
 * screen (or a few that share it), linking out to the full guide. In-app only —
 * never on the public `/docs` site or in its search. A card's id is its path
 * without extension (`admin/personnel`); there is no `index` collapsing.
 */
const helpCards = defineCollection({
    name: "helpCards",
    directory: "content/help",
    include: "**/*.mdx",
    schema: z.object({
        content: z.string(),
        /** The sheet title. */
        title: z.string(),
        /** The sheet subtitle; the sheet falls back to "Key info for this page". */
        description: z.string().optional(),
        /** The full guide: a doc slug with an optional `#anchor` (`skill-track/sessions#4-record-results`). */
        guide: z.string().min(1),
        /** Glossary slugs for the `<KeyTerms>` callout after the card body. */
        keyTerms: z.array(z.string()).default([]),
    }),
    transform: async (card, ctx) => {
        const file = `content/help/${card._meta.filePath}`;
        const [guideSlug, anchor, ...extra] = card.guide.split("#");
        if (extra.length > 0)
            throw new Error(`${file}: guide "${card.guide}" has more than one "#"`);
        // `ctx.documents` is typed as the raw docs schema (and may or may not be
        // transformed, depending on collection order), so recompute slug and
        // anchors from the raw doc rather than reading the docs transform's output.
        const doc = ctx
            .documents(docs)
            .find((d) => guideSlug !== "" && pathToSlug(d._meta.path) === guideSlug);
        if (!doc) throw new Error(`${file}: guide "${guideSlug}" is not a doc`);
        if (anchor !== undefined) {
            const anchors = headingAnchors(doc.content);
            if (!anchors.includes(anchor)) {
                throw new Error(
                    `${file}: guide "${card.guide}" — "#${anchor}" is not a heading in "${guideSlug}". Available: ${anchors.join(", ")}`,
                );
            }
        }
        const code = await compileMDX(ctx, card, docsMdxOptions);
        return {
            ...card,
            /** The card id, written by `<HelpButton id="…">` as `?help=<id>`. */
            id: card._meta.path,
            code,
            guideSlug,
            guideAnchor: anchor ?? null,
            /** The guide doc's section — a card is flag-hidden along with it. */
            section: doc.section,
        };
    },
});

/**
 * Product-update entries for the in-app "What's new" dialog and `/docs/updates`.
 * Files are `content/updates/YYYY-MM-DD-<slug>.mdx`; every file counts as
 * published (no scheduling). See `content/updates/README.md` for the authoring
 * rules and `src/lib/updates.ts` for the read model.
 */
const updates = defineCollection({
    name: "updates",
    directory: "content/updates",
    include: "*.mdx",
    schema: z.object({
        content: z.string(),
        title: z.string(),
        /** ISO date (`YYYY-MM-DD`), read as 00:00 UTC. The display date and the seen-cursor comparison. */
        publishedAt: z.iso.date(),
        description: z.string().optional(),
        /** The release the entry shipped in — display only. */
        version: z.string().optional(),
    }),
    transform: async (entry, ctx) => {
        // Ties count as seen, so a filename date that disagrees with
        // `publishedAt` can silently hide an entry — fail the build instead.
        if (!entry._meta.path.startsWith(`${entry.publishedAt}-`)) {
            throw new Error(
                `content/updates/${entry._meta.fileName}: filename must start with its publishedAt date ("${entry.publishedAt}-")`,
            );
        }
        const mdx = await compileMDX(ctx, entry, mdxOptions);
        return {
            ...entry,
            mdx,
            /** The filename without extension; the `#anchor` on `/docs/updates`. */
            slug: entry._meta.path,
        };
    },
});

export default defineConfig({
    content: [docs, helpCards, updates],
});
