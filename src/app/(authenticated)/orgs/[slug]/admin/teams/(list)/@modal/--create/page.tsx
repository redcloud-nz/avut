/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/teams/--create
 *
 * Renders in the `modal` slot of `../../layout.tsx`, so the teams list underneath it is
 * already on screen (mounted, not refetched) whether this was reached by clicking
 * "New Team" or by a direct load/refresh of this URL — both go through the same layout +
 * slot composition. Not an intercepted route: there's exactly one `--create/page.tsx`,
 * reused for both entry points, not a separate overlay-only variant.
 */

"use client";

import { useRouter } from "next/navigation";

import { AdminModule_CreateTeam_DialogContent } from "@/components/admin/teams/create-team";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

export default function AdminModule_CreateTeam_Page() {
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
