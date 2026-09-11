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

// This layout reads the session (via `requireSession()`) at the top of every authenticated
// route, which can't be part of the static prerender shell. The full fix is pushing that read
// behind a `<Suspense>` boundary with `use cache: private` per Next's Cache Components auth
// guide — an app-wide restructuring tracked by #135.
//
// This is a suppression, not a fix. Note that `instant = false` (what this replaced) does not
// work here: it opts out only *this* segment and does not halt the tree walk, so every page
// beneath still picks up implicit validation and reports this layout's blocking read as E1437.
// `unstable_disableValidation` is the one form that disables validation for the whole subtree.
// Scoped to this layout deliberately — public routes don't include it, so they keep validating
// (which #96 depends on). Remove this once the session read moves behind a boundary.
//
// See docs/reviews/suspense-boundaries.md §1 for the walk-through of Next's own source.
export const instant = { unstable_disableValidation: true } as const;

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
