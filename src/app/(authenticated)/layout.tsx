/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import { ReactNode } from "react";

import { ImpersonationBanner } from "@/components/system-admin/impersonation-banner";
import { ensureSession } from "@/server/auth-queries";
import { requireSession } from "@/server/session";
import { getServerQueryClient, HydrateClient } from "@/trpc/server";

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
            <ImpersonationBanner />
            {props.modal}
            {props.children}
        </HydrateClient>
    );
}
