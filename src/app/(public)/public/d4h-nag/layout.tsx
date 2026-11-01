/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Shared shell for `/public/d4h-nag/*`, the same header/footer as `/invitations/*`. Whoever
 * opens a reminder email's link may have no AVUT account, so the sign-in CTA is hidden.
 */

import type { ReactNode } from "react";

import { PublicFooter } from "@/components/nav/public-footer";
import { PublicHeader } from "@/components/nav/public-header";

export default function D4HNagPublicLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-svh w-full flex-col bg-background text-foreground">
            <PublicHeader showCta={false} />
            {children}
            <PublicFooter />
        </div>
    );
}
