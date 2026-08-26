/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";

import { AdminModule_CreateTeam_DialogContent } from "@/components/admin/teams/create-team";

/**
 * The `--create` route intercepted from within `/orgs/[slug]/admin/teams`: renders the
 * create-team dialog as an overlay on top of the already-mounted teams list instead of
 * navigating to a new page. Closing pops the URL back via `router.back()`.
 */
export function CreateTeam_InterceptedModal() {
    const router = useRouter();

    return (
        <AdminModule_CreateTeam_DialogContent
            open
            onOpenChange={(open) => {
                if (!open) router.back();
            }}
        />
    );
}
