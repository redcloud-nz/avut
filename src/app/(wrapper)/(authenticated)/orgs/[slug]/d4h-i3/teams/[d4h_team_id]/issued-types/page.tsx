/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HI3Module_TeamIssuedTypes } from "@/modules/d4h-i3/components/issued-types/team-issued-types";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: `Issued Types ${TITLE_SEPARATOR} D4H I3` };

export default async function D4HI3Module_TeamIssuedTypes_Page(
    props: PageProps<"/orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types">,
) {
    const { slug, d4h_team_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const teamId = Number(d4h_team_id);
    if (!Number.isInteger(teamId)) notFound();

    prefetch(trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }));
    prefetch(
        trpc.d4hApi.listTeamIssuedEquipment.queryOptions({
            organizationId: organization.id,
            teamId,
        }),
    );

    return (
        <HydrateClient>
            <D4HI3Module_TeamIssuedTypes teamId={teamId} />
        </HydrateClient>
    );
}
