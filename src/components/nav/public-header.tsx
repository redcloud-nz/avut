/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Shared header for every public (unauthenticated-reachable) page: `/`, `/docs`,
 * `/auth/*`, `/policies/*`. See docs/reviews/suspense-boundaries.md — the session
 * check backing the CTA is the only dynamic part of this component, isolated in
 * its own `<Suspense>` so pages using this header stay otherwise prerenderable.
 */

import { Suspense } from "react";

import Image from "next/image";
import Link from "next/link";
import { SiGithub } from "@icons-pack/react-simple-icons";

import { ModeToggle } from "@/components/nav/mode-toggle";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/link";
import { docsHref } from "@/lib/docs-sections";
import { REPO_URL } from "@/lib/site";
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
            <Link href="/orgs/--select-org">Open AVUT</Link>
        </Button>
    );
}

export function PublicHeader({
    showCta = true,
}: {
    /** Off on `/auth/*` — showing sign-in/sign-up CTAs while already on that flow is redundant. */
    showCta?: boolean;
}) {
    return (
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
            <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-6 px-6 py-3.5 md:px-10">
                <Link href="/" className="shrink-0">
                    <Image
                        src="/avut-logo.svg"
                        alt="A.V.U.T."
                        width={96}
                        height={32}
                        className="h-auto w-24 dark:invert"
                    />
                </Link>
                <nav className="flex items-center gap-4 text-sm text-muted-foreground">
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
