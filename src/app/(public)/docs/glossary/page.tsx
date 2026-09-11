/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs/glossary
 *
 * Flat A-Z glossary of AVUT's domain vocabulary. A literal route, so it takes
 * precedence over the `[[...slug]]` catch-all rather than being served as a
 * content-collections doc.
 */

import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getGlossaryEntriesSorted, glossaryBySlug } from "@/lib/glossary";
import { Modules } from "@/lib/modules";

export const metadata: Metadata = {
    title: "Glossary — Docs",
    description: "AVUT's domain vocabulary, from Catalogue to Team.",
};

export default function GlossaryPage() {
    const entries = getGlossaryEntriesSorted();

    return (
        <article>
            <h1 className="mt-2 mb-4 text-3xl font-bold tracking-tight">Glossary</h1>
            <p className="text-muted-foreground mb-8 leading-7">
                Definitions for the terms used across AVUT&apos;s documentation.
            </p>
            <dl className="flex flex-col gap-8">
                {entries.map((entry) => (
                    <div key={entry.slug} id={entry.slug} className="scroll-mt-20">
                        <dt className="flex items-center gap-2">
                            <span className="text-xl font-semibold">{entry.term}</span>
                            {entry.module && (
                                <Badge variant="outline">{Modules[entry.module].label}</Badge>
                            )}
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
        </article>
    );
}
