/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";

import { AdminModule_CreateTeam_DialogContent } from "@/components/admin/teams/create-team";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

/**
 * Renders the create-team dialog forced open, for a direct load or refresh of
 * `/orgs/[slug]/admin/teams/--create` — the case where Next's intercepting route
 * (`@modal/(.)--create`) didn't get a chance to intercept the navigation. Closing
 * navigates back to the plain teams list rather than `router.back()`, since a direct
 * load has no client-side history entry representing the list to pop back to.
 */
export function AdminModule_CreateTeam_DirectOverlay() {
    const organization = useOrganization();
    const router = useRouter();

    return (
        <AdminModule_CreateTeam_DialogContent
            open
            onOpenChange={(open) => {
                if (!open) {
                    router.push(route("/orgs/[slug]/admin/teams", { slug: organization.slug }));
                }
            }}
        />
    );
}
