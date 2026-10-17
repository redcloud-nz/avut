/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs/glossary
 *
 * Flat A-Z glossary of AVUT's domain vocabulary. A literal route, so it takes
 * precedence over the `[[...slug]]` catch-all rather than being served as a
 * content-collections doc. Entries whose modules are all flag-hidden are left
 * out (`getVisibleGlossaryEntries`).
 */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ScrollToHash } from "@/components/docs/scroll-to-hash";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { glossaryBySlug } from "@/lib/glossary";
import { Modules } from "@/lib/modules";
import { getVisibleGlossaryEntries } from "@/server/docs";

export const metadata: Metadata = {
    title: "Glossary — Docs",
    description: "AVUT's domain vocabulary, from Catalogue to Team.",
};

// Not `async`, and the boundary lives here rather than in a `loading.tsx`: the entry list reads
// module flags, which read `headers()`, so only the heading and intro are static shell. A
// `loading.tsx` nests inside the layout, which puts it *above* this segment's validation
// boundary — enough for the prerender check, but not for instant-navigation validation, which
// wants the Suspense below it. See docs/reviews/2026-09-12-suspense-boundaries.md §3.
export default function GlossaryPage() {
    return (
        <article className="max-w-3xl">
            <h1 className="mt-2 mb-4 text-3xl font-bold tracking-tight">Glossary</h1>
            <p className="text-muted-foreground mb-8 leading-7">
                Definitions for the terms used across AVUT&apos;s documentation.
            </p>
            <Suspense fallback={<GlossaryEntries_Skeleton />}>
                <GlossaryEntries />
            </Suspense>
        </article>
    );
}

async function GlossaryEntries() {
    const entries = await getVisibleGlossaryEntries();

    return (
        <>
            <ScrollToHash />
            <dl className="flex flex-col gap-8">
                {entries.map((entry) => (
                    <div key={entry.slug} id={entry.slug} className="scroll-mt-20">
                        <dt className="flex items-center gap-2">
                            <span className="text-xl font-semibold">{entry.term}</span>
                            {entry.modules?.map((moduleId) => (
                                <Badge key={moduleId} variant="outline">
                                    {Modules[moduleId].label}
                                </Badge>
                            ))}
                        </dt>
                        <dd className="mt-1 leading-7">
                            <p>{entry.longDefinition}</p>
                            {entry.relatedTerms && entry.relatedTerms.length > 0 && (
                                <p className="text-muted-foreground mt-2 text-sm">
                                    See also:{" "}
                                    {entry.relatedTerms.map((slug, i) => (
                                        <span key={slug}>
                                            {i > 0 && ", "}
                                            <Link
                                                href={`/docs/glossary#${slug}` as Route}
                                                className="text-primary underline underline-offset-2 hover:no-underline"
                                            >
                                                {glossaryBySlug.get(slug)?.term ?? slug}
                                            </Link>
                                        </span>
                                    ))}
                                </p>
                            )}
                        </dd>
                    </div>
                ))}
            </dl>
        </>
    );
}

function GlossaryEntries_Skeleton() {
    return (
        <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading">
            {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-7 w-1/3" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-4/5" />
                </div>
            ))}
        </div>
    );
}
