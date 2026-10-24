/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/teams/[d4h_team_id]/members/[member_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HModule_Member_Content } from "@/modules/d4h/components/members/member-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h/teams/[d4h_team_id]/members/[member_id]">;

function parseIds(d4h_team_id: string, member_id: string) {
    const teamId = Number(d4h_team_id);
    const memberId = Number(member_id);
    if (!Number.isInteger(teamId) || !Number.isInteger(memberId)) notFound();
    return { teamId, memberId };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, d4h_team_id, member_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const { teamId, memberId } = parseIds(d4h_team_id, member_id);

    try {
        const members = await fetchQuery(
            trpc.d4hApi.listTeamMembers.queryOptions({ organizationId: organization.id, teamId }),
        );
        const member = members.find((m) => m.id === memberId);
        return { title: `${member?.name ?? "Member"} ${TITLE_SEPARATOR} D4H` };
    } catch (error) {
        // No D4H token: keep a usable title, and let the page's error boundary explain.
        if (error instanceof TRPCError && error.code === "PRECONDITION_FAILED") {
            return { title: `Member ${TITLE_SEPARATOR} D4H` };
        }
        throw error;
    }
}

export default async function D4HModule_Member_Page(props: Props) {
    const { slug, d4h_team_id, member_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const { teamId, memberId } = parseIds(d4h_team_id, member_id);

    prefetch(trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listTeamMembers.queryOptions({ organizationId: organization.id, teamId }));
    prefetch(
        trpc.d4hApi.listMemberEquipment.queryOptions({
            organizationId: organization.id,
            teamId,
            memberId,
        }),
    );

    return (
        <HydrateClient>
            <D4HModule_Member_Content teamId={teamId} memberId={memberId} />
        </HydrateClient>
    );
}
