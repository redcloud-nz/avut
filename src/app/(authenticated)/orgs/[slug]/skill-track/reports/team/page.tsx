/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/reports/team
 */

import { Std } from "@/components/blocks/std";
import { SkillTrack_TeamCompetencyReport } from "@/components/skill-track/reports/team-competency-report";

import { TeamId } from "@/lib/schemas/team";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Team Competency`,
};

export default async function SkillTrack_ReportsTeamCompetency_Page(
    props: PageProps<"/orgs/[slug]/skill-track/reports/team">,
) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);
    const { team } = await props.searchParams;

    prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }));

    if (typeof team === "string") {
        const parsedTeamId = team === "all" ? undefined : TeamId.schema.safeParse(team);
        prefetch(
            trpc.skillChecks.getCompetencyMatrix.queryOptions({
                organizationId: organization.id,
                teamId: parsedTeamId && parsedTeamId.success ? parsedTeamId.data : undefined,
            }),
        );
    }

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SkillTrack_TeamCompetencyReport />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
