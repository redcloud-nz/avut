/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /docs
 *
 * Public, unauthenticated shell for the end-user documentation site. Prospective
 * organizations can browse this before signing up (mirrors `(public)/policies`). Lives in its
 * own `(docs)` route group, sibling to `(marketing)` and `auth`, so it renders its own
 * header and footer rather than inheriting the marketing ones.
 */

import { Suspense, type ReactNode } from "react";

import { DocsNav_Skeleton } from "@/components/docs/docs-nav-skeleton";
import { DocsSearch } from "@/components/docs/docs-search";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { PublicFooter } from "@/components/nav/public-footer";
import { PublicHeader } from "@/components/nav/public-header";
import { getVisibleDocsNav } from "@/server/docs";

// Not `async`. `getVisibleDocsNav()` resolves module flags, which read headers, so awaiting it
// here would block the whole `/docs` subtree — the chrome below would never reach the static
// shell. The read lives in `<DocsNav>` behind a boundary instead, leaving the header and main
// frame prerenderable. See docs/reviews/2026-09-12-suspense-boundaries.md §3.
export default function DocsLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-svh w-full flex-col bg-background text-foreground">
            <PublicHeader
                wide
                search={
                    <div className="hidden md:block">
                        <DocsSearch className="w-40 lg:w-56" />
                    </div>
                }
            />
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4">
                <div className="flex flex-1 gap-10 py-8">
                    <aside className="hidden w-56 shrink-0 md:block">
                        <div className="sticky top-8">
                            <Suspense fallback={<DocsNav_Skeleton />}>
                                <DocsNav />
                            </Suspense>
                        </div>
                    </aside>
                    <main className="min-w-0 max-w-3xl flex-1">{children}</main>
                </div>
            </div>
            <PublicFooter />
        </div>
    );
}

/** The flag-filtered nav. Isolated so its runtime read doesn't block the docs shell. */
async function DocsNav() {
    return <DocsSidebar nav={await getVisibleDocsNav()} />;
}
