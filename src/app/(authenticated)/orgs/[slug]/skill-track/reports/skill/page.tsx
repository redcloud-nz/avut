/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/reports/skill
 */

import { Suspense } from "react";

import { Std } from "@/components/blocks/std";
import { SkillTrack_SkillCoverageReport } from "@/components/skill-track/reports/skill-coverage-report";
import { PageLoadingSpinner } from "@/components/ui/loading";

import { route } from "@/lib/routes";
import { SkillId } from "@/lib/schemas/skill";
import { TeamId } from "@/lib/schemas/team";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Skill Coverage`,
};

export default async function SkillTrack_ReportsSkillCoverage_Page(
    props: PageProps<"/orgs/[slug]/skill-track/reports/skill">,
) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);
    const { skill, team } = await props.searchParams;

    prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.skills.listAssessableSkills.queryOptions({ organizationId: organization.id }));

    // Only prefetch the competency matrix for a well-formed skill id — an invalid `?skill=`
    // falls back to the picker client-side, so fetching the full org matrix here is wasted work.
    const parsedSkillId = typeof skill === "string" ? SkillId.schema.safeParse(skill) : undefined;
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
            <Std.SidebarInset>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
                        {
                            label: "Reports",
                            href: route("/orgs/[slug]/skill-track/reports", { slug }),
                        },
                        {
                            label: "Skill Coverage",
                            href: route("/orgs/[slug]/skill-track/reports/skill", { slug }),
                        },
                    ]}
                />
                <Suspense fallback={<PageLoadingSpinner />}>
                    <SkillTrack_SkillCoverageReport />
                </Suspense>
            </Std.SidebarInset>
        </HydrateClient>
    );
}
