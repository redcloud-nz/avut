/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track/reports/matrix
 */

import { connection } from "next/server";
import { Suspense } from "react";

import { PageLoadingSpinner } from "@/components/ui/loading";
import { syntheticChecksFlag } from "@/lib/flags";
import { route } from "@/lib/routes";
import { SkillTrack_SkillMatrixReport } from "@/modules/skill-track/components/reports/skill-matrix-report";
import { requireTeam } from "@/server/team-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Personnel × Skill Matrix Report`,
};

export default async function Team_SkillTrack_ReportsSkillMatrix_Page(
    props: PageProps<"/teams/[slug]/skill-track/reports/matrix">,
) {
    const { slug } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization, team } = await requireTeam(slug);
    // Flag evaluation reads the clock, which Cache Components rejects until the render is
    // marked request-time.
    await connection();
    const syntheticChecksEnabled = await syntheticChecksFlag();

    // Fixed to the team: no scope picker, so no `?team=` and no team list.
    prefetch(
        trpc.skillChecks.getCompetencyMatrix.queryOptions({
            organizationId: organization.id,
            teamId: team.id,
        }),
    );

    return (
        <HydrateClient>
            <Suspense fallback={<PageLoadingSpinner />}>
                <SkillTrack_SkillMatrixReport
                    syntheticChecksEnabled={syntheticChecksEnabled}
                    team={{ id: team.id, name: team.name }}
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
