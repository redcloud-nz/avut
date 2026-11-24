/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Shared shell for `/forms/kit-check/*`. Whoever opens a kit-check link may have no AVUT
 * account, and most open it on a phone: a slim header that scrolls away (not the sticky public
 * header), so the form keeps the screen. The footer sits after the form, as on other public pages.
 */

import Image from "next/image";
import type { ReactNode } from "react";

import { ModeToggle } from "@/components/nav/mode-toggle";
import { PublicFooter } from "@/components/nav/public-footer";

export default function KitCheckPublicLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-svh w-full flex-col bg-background text-foreground">
            <header className="border-b border-border">
                <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-1.5">
                    <Image
                        src="/avut-logo.svg"
                        alt="A.V.U.T."
                        width={64}
                        height={21}
                        loading="eager"
                        className="h-auto w-16 dark:invert"
                    />
                    <ModeToggle />
                </div>
            </header>
            <main className="flex-1">{children}</main>
            <PublicFooter />
        </div>
    );
}
