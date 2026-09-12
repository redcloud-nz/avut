/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import { ReactNode } from "react";

import { AppProviders } from "@/components/providers/app-providers";
import { ImpersonationBanner } from "@/components/system-admin/impersonation-banner";
import { ensureSession } from "@/server/auth-queries";
import { requireSession } from "@/server/session";
import { getServerQueryClient, HydrateClient } from "@/trpc/server";

// This layout used to carry `export const instant = { unstable_disableValidation: true }` to
// suppress E1437 for the whole authenticated subtree, because `requireSession()` below is a
// blocking request read. That suppression is no longer needed: `(wrapper)/loading.tsx` now sits
// above this layout, so the read happens *inside* a Suspense boundary and validation is
// satisfied honestly. Verified by removing that file — the build then fails on every
// `/orgs/[slug]/…` route. Keep the two facts together: this layout may block only for as long
// as a boundary stays above it.
export default async function AuthenticatedLayout(props: {
    modal: ReactNode;
    children: ReactNode;
}) {
    // Baseline guard for every authenticated route. The proxy only checks that a session
    // cookie is *present*; this is the check that actually validates it.
    await requireSession();

    // Seed the session into the request-scoped cache once, here, so every client
    // `useSession()` below renders it on first paint with no fetch on mount.
    await ensureSession(getServerQueryClient());

    return (
        <HydrateClient>
            <AppProviders>
                <ImpersonationBanner />
                {props.modal}
                {props.children}
            </AppProviders>
        </HydrateClient>
    );
}
