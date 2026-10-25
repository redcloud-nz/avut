/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/teams/[d4h_team_id]/members
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HModule_TeamMembers_List } from "@/modules/d4h/components/members/team-members-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: `Members ${TITLE_SEPARATOR} D4H` };

export default async function D4HModule_TeamMembers_Page(
    props: PageProps<"/orgs/[slug]/d4h/teams/[d4h_team_id]/members">,
) {
    const { slug, d4h_team_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const teamId = Number(d4h_team_id);
    if (!Number.isInteger(teamId)) notFound();

    prefetch(trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listTeamMembers.queryOptions({ organizationId: organization.id, teamId }));

    return (
        <HydrateClient>
            <D4HModule_TeamMembers_List teamId={teamId} />
        </HydrateClient>
    );
}
