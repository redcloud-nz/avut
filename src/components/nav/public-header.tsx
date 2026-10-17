/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Shared header for every public (unauthenticated-reachable) page: `/`, `/docs`,
 * `/auth/*`, `/policies/*`. See docs/reviews/2026-09-12-suspense-boundaries.md — the session
 * check backing the CTA is the only dynamic part of this component, isolated in
 * its own `<Suspense>` so pages using this header stay otherwise prerenderable.
 */

import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { SiGithub } from "@icons-pack/react-simple-icons";

import { ModeToggle } from "@/components/nav/mode-toggle";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/link";
import { docsHref } from "@/lib/docs-sections";
import { REPO_URL } from "@/lib/site";
import { cn } from "@/lib/utils";
import { hasActiveSession } from "@/server/session";

function SignedOutCta() {
    return (
        <>
            <Button asChild variant="outline" size="sm">
                <Link href="/auth/sign-in">Sign In</Link>
            </Button>
            <Button asChild size="sm">
                <Link href="/auth/sign-up">Sign Up</Link>
            </Button>
        </>
    );
}

async function HeaderCta() {
    if (!(await hasActiveSession())) return <SignedOutCta />;
    return (
        <Button asChild size="sm">
            <Link href="/user">Open AVUT</Link>
        </Button>
    );
}

export function PublicHeader({
    showCta = true,
    menu,
    search,
    wide = false,
}: {
    /** Off on `/auth/*` — showing sign-in/sign-up CTAs while already on that flow is redundant. */
    showCta?: boolean;
    /** Rendered before the logo, grouped with it — the docs' mobile nav trigger. */
    menu?: ReactNode;
    /** Rendered first in the right-hand nav — the docs search. */
    search?: ReactNode;
    /** Widens the container to `max-w-7xl` so the header's edges line up with the docs columns, and tightens it below `sm`. */
    wide?: boolean;
}) {
    return (
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
            <div
                className={cn(
                    "mx-auto flex items-center justify-between py-3.5 md:px-10",
                    // Below `sm`, `wide` (the docs) tightens the padding and gaps to make room for
                    // the `menu` button at 360px. The docs body matches this padding.
                    wide ? "max-w-7xl gap-3 px-4 sm:gap-6 sm:px-6" : "max-w-[1120px] gap-6 px-6",
                )}
            >
                <div className="flex items-center gap-2">
                    {menu}
                    <Link href="/" className="shrink-0">
                        <Image
                            src="/avut-logo.svg"
                            alt="A.V.U.T."
                            width={96}
                            height={32}
                            loading="eager"
                            className="h-auto w-24 dark:invert"
                        />
                    </Link>
                </div>
                <nav
                    className={cn(
                        "flex items-center text-sm text-muted-foreground",
                        wide ? "gap-2 sm:gap-4" : "gap-4",
                    )}
                >
                    {search}
                    <Link href="/tools" className="hidden hover:text-foreground sm:inline">
                        Tools
                    </Link>
                    <Link href={docsHref("")} className="hidden hover:text-foreground sm:inline">
                        Docs
                    </Link>
                    <ExternalLink
                        href={REPO_URL}
                        aria-label="GitHub"
                        noDecoration
                        className="hidden hover:text-foreground sm:inline"
                    >
                        <SiGithub className="size-4" />
                    </ExternalLink>
                    <ModeToggle />
                    {showCta && (
                        <div className="flex items-center gap-1.5">
                            <Suspense fallback={<SignedOutCta />}>
                                <HeaderCta />
                            </Suspense>
                        </div>
                    )}
                </nav>
            </div>
        </header>
    );
}
