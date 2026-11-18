/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]
 */

import { Team_Dashboard_Content } from "@/components/team/dashboard-content";
import { hasAnyRoleWithPermissions } from "@/lib/permissions";
import { requireTeam } from "@/server/team-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function Team_Index_Page(props: PageProps<"/teams/[slug]">) {
    const { slug } = await props.params;
    // Cached per request, and already loaded by the team layout (which seeds `teamScope.getTeam`).
    // Only for the roles here: it guards nothing, since `listRoster` checks `team: ["view"]` itself.
    const { roles } = await requireTeam(slug);

    // The roster card shows only behind `team: ["view"]`. Without it the prefetch would fail
    // FORBIDDEN on every visit, for a query nothing on the page reads.
    if (hasAnyRoleWithPermissions(roles, { team: ["view"] })) {
        prefetch(trpc.teamScope.listRoster.queryOptions({ teamSlug: slug }));
    }

    return (
        <HydrateClient>
            <Team_Dashboard_Content />
        </HydrateClient>
    );
}
