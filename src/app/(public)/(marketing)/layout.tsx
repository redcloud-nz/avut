/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Shared shell for the marketing-facing public pages — `/`, `/docs`, `/policies/*` — with the
 * full header (Docs link, GitHub, theme toggle, sign-in/sign-up CTA) and footer. `/auth/*` gets
 * its own sibling layout with the CTA hidden — see `(public)/auth/layout.tsx`.
 */

import type { ReactNode } from "react";

import { PublicFooter } from "@/components/nav/public-footer";
import { PublicHeader } from "@/components/nav/public-header";

export default function MarketingLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-svh w-full flex-col bg-background text-foreground">
            <PublicHeader />
            {children}
            <PublicFooter />
        </div>
    );
}
