/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs/[[...slug]]
 *
 * Renders one documentation page from the compiled `docs` content collection.
 * The in-app `?help=<id>` sheet shows a separate help card (`content/help/**`),
 * not this page.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { MDXContent } from "@content-collections/mdx/react";

import { SaratogaContentsSpacer } from "@/components/blocks/saratoga-contents";
import { DocsArticle_Skeleton } from "@/components/docs/docs-article-skeleton";
import { DocsContents } from "@/components/docs/docs-contents";
import { DocsFlagsProvider } from "@/components/docs/docs-flags-context";
import { KeyTerms } from "@/components/docs/key-terms";
import { docsMdxComponents } from "@/components/docs/mdx-components";
import { getAllDocSlugs } from "@/lib/docs";
import { syntheticChecksFlag } from "@/lib/flags";
import { getVisibleDocBySlug } from "@/server/docs";

interface DocsPageProps {
    params: Promise<{ slug?: string[] }>;
}

// Every doc is a static param; a doc in a flag-hidden section still 404s at
// request time via `getVisibleDocBySlug` (flag evaluation reads `headers()`, so
// it cannot run here — `generateStaticParams` has no request).
export function generateStaticParams(): { slug: string[] }[] {
    return getAllDocSlugs().map((slug) => ({ slug: slug === "" ? [] : slug.split("/") }));
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
    const { slug } = await params;
    const doc = await getVisibleDocBySlug((slug ?? []).join("/"));
    if (!doc) return {};
    return { title: `${doc.title} — Docs`, description: doc.description };
}

// Not `async`, and the boundary lives here rather than in a `loading.tsx`: a `loading.tsx` nests
// inside the layout, which puts it *above* this segment's validation boundary — enough for the
// prerender check, but not for instant-navigation validation, which wants the Suspense below it.
// See docs/reviews/2026-09-12-suspense-boundaries.md §3.
export default function DocsPage({ params }: DocsPageProps) {
    return (
        <Suspense
            fallback={
                <div className="max-w-3xl">
                    <DocsArticle_Skeleton />
                </div>
            }
        >
            <DocsArticle params={params} />
        </Suspense>
    );
}

async function DocsArticle({ params }: DocsPageProps) {
    const { slug } = await params;
    const doc = await getVisibleDocBySlug((slug ?? []).join("/"));
    if (!doc) notFound();
    const syntheticChecksEnabled = await syntheticChecksFlag();
    const hasContents = doc.headings.filter((h) => h.depth === 2 || h.depth === 3).length >= 2;

    return (
        <DocsFlagsProvider syntheticChecksEnabled={syntheticChecksEnabled}>
            <div className="flex gap-10">
                <article className="min-w-0 max-w-3xl flex-1">
                    <MDXContent code={doc.introMdx} components={docsMdxComponents} />
                    <KeyTerms slugs={doc.keyTerms} />
                    {doc.restMdx && (
                        <MDXContent code={doc.restMdx} components={docsMdxComponents} />
                    )}
                    {/* Lets the last sections scroll up to the "On this page" trigger line. Only
                        when that list shows: it needs two or more `##`/`###` headings. */}
                    {hasContents && <SaratogaContentsSpacer className="lg:hidden xl:block" />}
                </article>
                <aside className="hidden w-52 shrink-0 xl:block">
                    <DocsContents headings={doc.headings} />
                </aside>
            </div>
        </DocsFlagsProvider>
    );
}
