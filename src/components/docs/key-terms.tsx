/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Per-page "Key terms" callout: short definitions for the glossary slugs a doc
 * page lists in its `keyTerms` frontmatter, each linking to its full entry on
 * `/docs/glossary`.
 */

import type { Route } from "next";
import Link from "next/link";

import { glossaryBySlug } from "@/lib/glossary";

export function KeyTerms({ slugs }: { slugs: string[] }) {
    const entries = slugs
        .map((slug) => glossaryBySlug.get(slug))
        .filter((entry) => entry !== undefined)
        .sort((a, b) => a.term.localeCompare(b.term));
    if (entries.length === 0) return null;

    return (
        <div className="bg-card my-6 rounded-lg border p-4 text-sm">
            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Key terms
            </p>
            <dl className="flex flex-col gap-2">
                {entries.map((entry) => (
                    <div key={entry.slug}>
                        <dt className="inline font-semibold">
                            <Link
                                href={`/docs/glossary#${entry.slug}` as Route}
                                className="hover:underline"
                            >
                                {entry.term}
                            </Link>
                        </dt>
                        <dd className="text-muted-foreground inline">
                            {" — "}
                            {entry.shortDefinition}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
