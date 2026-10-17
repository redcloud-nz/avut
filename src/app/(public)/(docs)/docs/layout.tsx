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

import { DocsMobileNav } from "@/components/docs/docs-mobile-nav";
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
                menu={
                    <DocsMobileNav>
                        <Suspense fallback={<DocsNav_Skeleton />}>
                            <DocsNav />
                        </Suspense>
                    </DocsMobileNav>
                }
                search={
                    <div className="hidden md:block">
                        <DocsSearch className="w-40 lg:w-56" />
                    </div>
                }
            />
            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-6 md:px-10">
                <div className="flex flex-1 gap-10">
                    <aside className="hidden w-56 shrink-0 md:block">
                        {/* 61px is the sticky header's height (see `docs-contents.tsx`). The padding
                            lives inside the scroll area so the whole nav stays reachable. */}
                        <div className="sticky top-[61px] max-h-[calc(100svh-61px)] overflow-y-auto py-8">
                            <Suspense fallback={<DocsNav_Skeleton />}>
                                <DocsNav />
                            </Suspense>
                        </div>
                    </aside>
                    <main className="min-w-0 flex-1 py-8">{children}</main>
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
