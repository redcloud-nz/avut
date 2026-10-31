/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/teams/[d4h_team_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HModule_Team_Content } from "@/modules/d4h/components/teams/team-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h/teams/[d4h_team_id]">;

function parseTeamId(d4h_team_id: string) {
    const teamId = Number(d4h_team_id);
    if (!Number.isInteger(teamId)) notFound();
    return teamId;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, d4h_team_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const teamId = parseTeamId(d4h_team_id);

    try {
        const teams = await fetchQuery(
            trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
        );
        const team = teams.find((t) => t.id === teamId);
        return { title: `${team?.title ?? "Team"} ${TITLE_SEPARATOR} D4H` };
    } catch (error) {
        // No D4H token: keep a usable title, and let the page's error boundary explain.
        if (error instanceof TRPCError && error.code === "PRECONDITION_FAILED") {
            return { title: `Team ${TITLE_SEPARATOR} D4H` };
        }
        throw error;
    }
}

export default async function D4HModule_Team_Page(props: Props) {
    const { slug, d4h_team_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const teamId = parseTeamId(d4h_team_id);

    prefetch(trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <D4HModule_Team_Content teamId={teamId} />
        </HydrateClient>
    );
}
