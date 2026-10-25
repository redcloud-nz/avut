/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/members
 */

import { Metadata } from "next";
import { redirect } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { route } from "@/lib/routes";
import { D4HModule_Members_SelectTeam } from "@/modules/d4h/components/members/select-team";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: `Members ${TITLE_SEPARATOR} D4H` };

/**
 * Members are listed per team: this landing page sends the viewer on to one team's members. With
 * one team it redirects there; with none or several, the client component shows an empty state or
 * the team picker.
 */
export default async function D4HModule_Members_Page(props: PageProps<"/orgs/[slug]/d4h/members">) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const teamsQuery = trpc.d4hApi.listAccessibleTeams.queryOptions({
        organizationId: organization.id,
    });

    // Awaited, unlike the usual `prefetch`, so the one-team case redirects before anything renders.
    const teams = await fetchQuery(teamsQuery).catch((error: unknown) => {
        // No D4H token: render the client component, whose query fails into the error boundary.
        if (error instanceof TRPCError && error.code === "PRECONDITION_FAILED") return null;
        throw error;
    });

    if (teams?.length === 1) {
        redirect(
            route("/orgs/[slug]/d4h/teams/[d4h_team_id]/members", {
                slug,
                d4h_team_id: String(teams[0].id),
            }),
        );
    }

    prefetch(teamsQuery);

    return (
        <HydrateClient>
            <D4HModule_Members_SelectTeam />
        </HydrateClient>
    );
}
