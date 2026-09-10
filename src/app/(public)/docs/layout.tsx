/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs
 *
 * Public, unauthenticated shell for the end-user documentation site. Prospective
 * organizations can browse this before signing up (mirrors `(public)/policies`).
 */

import type { ReactNode } from "react";
import Link from "next/link";

import { DocsSearch } from "@/components/docs/docs-search";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { docsHref } from "@/lib/docs";
import { getVisibleDocsNav } from "@/server/docs";

export default async function DocsLayout({ children }: { children: ReactNode }) {
    const nav = await getVisibleDocsNav();

    return (
        <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-4">
            <header className="flex h-14 items-center justify-between gap-4 border-b">
                <Link href={docsHref("")} className="font-semibold">
                    {process.env.NEXT_PUBLIC_APP_DISPLAY_NAME ?? "AVUT"} Docs
                </Link>
                <div className="flex items-center gap-4">
                    <DocsSearch />
                    <Link href="/" className="text-muted-foreground text-sm hover:underline">
                        Back to app
                    </Link>
                </div>
            </header>
            <div className="flex flex-1 gap-10 py-8">
                <aside className="hidden w-56 shrink-0 md:block">
                    <div className="sticky top-8">
                        <DocsSidebar nav={nav} />
                    </div>
                </aside>
                <main className="min-w-0 max-w-3xl flex-1">{children}</main>
            </div>
        </div>
    );
}
