/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/reports/matrix
 */

import { Std } from "@/components/blocks/std";
import { SkillTrack_SkillMatrixReport } from "@/components/skill-track/reports/skill-matrix-report";

import { TeamId } from "@/lib/schemas/team";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Personnel × Skill Matrix`,
};

export default async function SkillTrack_ReportsSkillMatrix_Page(
    props: PageProps<"/orgs/[slug]/skill-track/reports/matrix">,
) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);
    const { team } = await props.searchParams;

    prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }));

    // A malformed `?team=` isn't "whole org" — it's "nothing picked yet", so skip the
    // prefetch and let the client show the scope picker instead.
    if (team === "all") {
        prefetch(
            trpc.skillChecks.getCompetencyMatrix.queryOptions({
                organizationId: organization.id,
                teamId: undefined,
            }),
        );
    } else if (typeof team === "string") {
        const parsedTeamId = TeamId.schema.safeParse(team);
        if (parsedTeamId.success) {
            prefetch(
                trpc.skillChecks.getCompetencyMatrix.queryOptions({
                    organizationId: organization.id,
                    teamId: parsedTeamId.data,
                }),
            );
        }
    }

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SkillTrack_SkillMatrixReport />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
