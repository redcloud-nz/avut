/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Shared footer for every public (unauthenticated-reachable) page. See public-header.tsx.
 */

import Image from "next/image";
import Link from "next/link";
import { SiGithub } from "@icons-pack/react-simple-icons";

import { CopyrightString } from "@/components/ui/copyright";
import { ExternalLink } from "@/components/ui/link";
import { REPO_URL, REPO_SLUG } from "@/lib/site";

export function PublicFooter() {
    return (
        <>
            <div className="bg-foreground text-background">
                <section className="mx-auto flex max-w-[1120px] flex-col justify-between gap-6 px-6 py-9 sm:flex-row sm:items-center md:px-10">
                    <div className="flex flex-col gap-1.5">
                        <div className="text-lg font-medium">Open source, MIT licensed.</div>
                        <p className="text-sm leading-relaxed text-background/70">
                            Read the code, file an issue, or run your own copy. Next.js, Postgres,
                            tRPC — nothing exotic.
                        </p>
                    </div>
                    <ExternalLink
                        href={REPO_URL}
                        noDecoration
                        className="inline-flex h-9 shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-md bg-background/10 px-3.5 text-sm font-medium text-background hover:bg-background/20 sm:self-auto"
                    >
                        <SiGithub className="size-4" />
                        {REPO_SLUG}
                    </ExternalLink>
                </section>
            </div>

            <footer className="border-t border-border">
                <div className="mx-auto flex max-w-[1120px] flex-col justify-between gap-4 px-6 py-6 pb-10 text-[13px] text-muted-foreground sm:flex-row sm:items-center md:px-10">
                    <Image
                        src="/avut-logo.svg"
                        alt="A.V.U.T."
                        width={72}
                        height={24}
                        className="h-auto w-[72px] opacity-60 dark:invert"
                    />
                    <div className="flex flex-wrap items-center gap-5">
                        <Link href="/policies/privacy" className="hover:text-foreground">
                            Privacy Policy
                        </Link>
                        <Link href="/policies/terms-of-service" className="hover:text-foreground">
                            Terms of Service
                        </Link>
                        <CopyrightString />
                    </div>
                </div>
            </footer>
        </>
    );
}
