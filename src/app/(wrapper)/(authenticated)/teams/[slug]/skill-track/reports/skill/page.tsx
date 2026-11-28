/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track/reports/skill
 */

import { connection } from "next/server";
import { Suspense } from "react";

import { PageLoadingSpinner } from "@/components/ui/loading";
import { syntheticChecksFlag } from "@/lib/flags";
import { route } from "@/lib/routes";
import { SkillId } from "@/lib/schemas/skill";
import { TeamId } from "@/lib/schemas/team";
import { SkillTrack_SkillCoverageReport } from "@/modules/skill-track/components/reports/skill-coverage-report";
import { requireTeam } from "@/server/team-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Skill Coverage Report`,
};

export default async function Team_SkillTrack_ReportsSkillCoverage_Page(
    props: PageProps<"/teams/[slug]/skill-track/reports/skill">,
) {
    const { slug } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization } = await requireTeam(slug);
    const { skill, team, action } = await props.searchParams;
    // Flag evaluation reads the clock, which Cache Components rejects until the render is
    // marked request-time.
    await connection();
    const syntheticChecksEnabled = await syntheticChecksFlag();

    // The loaded report reads the team list itself; the scope dialog reads it too.
    prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }));

    const parsedSkillId = typeof skill === "string" ? SkillId.schema.safeParse(skill) : undefined;

    // The scope dialog lists assessable skills, but only fetches them once it's open. It opens
    // on arrival when no valid skill is picked yet (`forceOpen`) or via `?action=select-scope`;
    // otherwise the list isn't needed until the user opens it, so don't pay for it here.
    if (!parsedSkillId?.success || action === "select-scope") {
        prefetch(
            trpc.skillPackageSubscriptions.listAssessableSkills.queryOptions({
                organizationId: organization.id,
            }),
        );
    }

    if (parsedSkillId?.success) {
        const parsedTeamId = typeof team === "string" ? TeamId.schema.safeParse(team) : undefined;
        prefetch(
            trpc.skillChecks.getCompetencyMatrix.queryOptions({
                organizationId: organization.id,
                skillId: parsedSkillId.data,
                teamId: parsedTeamId && parsedTeamId.success ? parsedTeamId.data : undefined,
            }),
        );
    }

    return (
        <HydrateClient>
            <Suspense fallback={<PageLoadingSpinner />}>
                <SkillTrack_SkillCoverageReport
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
