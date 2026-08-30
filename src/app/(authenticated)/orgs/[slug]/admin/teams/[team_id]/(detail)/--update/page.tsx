/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/teams/[team_id]/--update
 *
 * Renders as `children` of `../layout.tsx`, so the team detail page underneath it is
 * already on screen (mounted, not refetched) whether reached by clicking the edit icon or
 * by a direct load/refresh of this URL.
 */

"use client";

import { use } from "react";
import { useRouter } from "next/navigation";

import { useSuspenseQuery } from "@tanstack/react-query";

import { AdminModule_UpdateTeam_DialogContent } from "@/components/admin/teams/update-team";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export default function AdminModule_UpdateTeam_Page(
    props: PageProps<"/orgs/[slug]/admin/teams/[team_id]/--update">,
) {
    const { team_id } = use(props.params);
    const teamId = TeamId.schema.parse(team_id);

    const organization = useOrganization();
    const router = useRouter();

    const { data: team } = useSuspenseQuery(
        trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
    );

    return (
        <AdminModule_UpdateTeam_DialogContent
            team={team}
            open
            onOpenChange={(open) => {
                if (!open) {
                    router.push(
                        route("/orgs/[slug]/admin/teams/[team_id]", {
                            slug: organization.slug,
                            team_id: teamId,
                        }),
                    );
                }
            }}
        />
    );
}
