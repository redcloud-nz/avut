/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Shared shell for `/auth/*`, the same header/footer as the marketing pages (see
 * `(public)/(marketing)/layout.tsx`) but with the sign-in/sign-up CTA hidden — redundant while
 * already on an auth flow.
 */

import type { ReactNode } from "react";

import { PublicFooter } from "@/components/nav/public-footer";
import { PublicHeader } from "@/components/nav/public-header";

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-svh w-full flex-col bg-background text-foreground">
            <PublicHeader showCta={false} />
            {children}
            <PublicFooter />
        </div>
    );
}
