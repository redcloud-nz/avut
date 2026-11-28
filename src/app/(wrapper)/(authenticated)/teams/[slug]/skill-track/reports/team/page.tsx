/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track/reports/team
 */

import { connection } from "next/server";
import { Suspense } from "react";

import { PageLoadingSpinner } from "@/components/ui/loading";
import { syntheticChecksFlag } from "@/lib/flags";
import { route } from "@/lib/routes";
import { TeamId } from "@/lib/schemas/team";
import { SkillTrack_TeamCompetencyReport } from "@/modules/skill-track/components/reports/team-competency-report";
import { requireTeam } from "@/server/team-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Team Competency Report`,
};

export default async function Team_SkillTrack_ReportsTeamCompetency_Page(
    props: PageProps<"/teams/[slug]/skill-track/reports/team">,
) {
    const { slug } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization } = await requireTeam(slug);
    const { team } = await props.searchParams;
    // Flag evaluation reads the clock, which Cache Components rejects until the render is
    // marked request-time.
    await connection();
    const syntheticChecksEnabled = await syntheticChecksFlag();

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
            <Suspense fallback={<PageLoadingSpinner />}>
                <SkillTrack_TeamCompetencyReport
                    syntheticChecksEnabled={syntheticChecksEnabled}
                    breadcrumbs={[
                        {
                            label: "Skills Reports",
                            href: route("/teams/[slug]/skill-track/reports", { slug }),
                        },
                    ]}
                />
            </Suspense>
        </HydrateClient>
    );
}
