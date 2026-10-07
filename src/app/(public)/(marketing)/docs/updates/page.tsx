/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs/updates
 *
 * Every "What's new" entry from the `updates` content collection, one per
 * release, newest first, each at its own `#v<version>` anchor. A literal route, so it takes precedence over
 * the `[[...slug]]` catch-all (as `docs/glossary` does). The in-app What's new
 * dialog links here.
 */

import type { Metadata } from "next";

import { UpdateArticle } from "@/components/whats-new/update-article";
import { getAllUpdates } from "@/lib/updates";

export const metadata: Metadata = {
    title: "What's new — Docs",
    description: "What's new in each release of AVUT, newest first.",
};

export default function UpdatesPage() {
    const entries = getAllUpdates();

    return (
        <div>
            <h1 className="mt-2 mb-4 text-3xl font-bold tracking-tight">What&apos;s new</h1>
            <p className="text-muted-foreground mb-8 leading-7">
                What&apos;s new in each release of AVUT, newest first.
            </p>
            {entries.length === 0 ? (
                <p className="text-muted-foreground">No updates yet.</p>
            ) : (
                <div className="flex flex-col gap-12">
                    {entries.map((entry) => (
                        <UpdateArticle key={entry.slug} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    );
}
