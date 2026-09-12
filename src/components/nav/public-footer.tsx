/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Shared footer for every public (unauthenticated-reachable) page. See public-header.tsx.
 * The "Open source, MIT licensed" banner is home-page-only — see marketing/oss-banner.tsx.
 */

import Image from "next/image";
import Link from "next/link";

import { CopyrightString } from "@/components/ui/copyright";

export function PublicFooter() {
    return (
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
    );
}
