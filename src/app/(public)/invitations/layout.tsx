/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Shared shell for `/invitations/*`, the same header/footer as `/auth/*` — the page is the
 * front door for someone who may not have an account yet, so the sign-in CTA is hidden.
 */

import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { PublicFooter } from "@/components/nav/public-footer";
import { PublicHeader } from "@/components/nav/public-header";

export default function InvitationsLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-svh w-full flex-col bg-background text-foreground">
            <PublicHeader showCta={false} />
            {/* (public) sits outside (wrapper)/layout.tsx's AppProviders, so the Decline
                confirmation dialog's `?action=` param needs its own adapter here. */}
            <NuqsAdapter>{children}</NuqsAdapter>
            <PublicFooter />
        </div>
    );
}
