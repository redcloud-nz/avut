/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/reports/skill
 */

import { Suspense } from "react";

import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { SkillTrack_SkillCoverageReport } from "@/components/skill-track/reports/skill-coverage-report";
import { PageLoadingSpinner } from "@/components/ui/loading";
import { syntheticChecksFlag } from "@/lib/flags";
import { route } from "@/lib/routes";
import { SkillId } from "@/lib/schemas/skill";
import { TeamId } from "@/lib/schemas/team";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Skill Coverage Report`,
};

export default async function SkillTrack_ReportsSkillCoverage_Page(
    props: PageProps<"/orgs/[slug]/skill-track/reports/skill">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const { skill, team, action } = await props.searchParams;
    const syntheticChecksEnabled = await syntheticChecksFlag();

    // The loaded report reads the team list itself; the scope dialog reads it too.
    prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }));

    const parsedSkillId = typeof skill === "string" ? SkillId.schema.safeParse(skill) : undefined;

    // The scope dialog lists assessable skills, but only fetches them once it's open. It opens
    // on arrival when no valid skill is picked yet (`forceOpen`) or via `?action=select-scope`;
    // otherwise the list isn't needed until the user opens it, so don't pay for it here.
    if (!parsedSkillId?.success || action === "select-scope") {
        prefetch(
            trpc.skills.listAssessableSkills.queryOptions({ organizationId: organization.id }),
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
            <>
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
                    actions={<HelpButton slug="skill-track/reports" />}
                />
                <Suspense fallback={<PageLoadingSpinner />}>
                    <SkillTrack_SkillCoverageReport
                        syntheticChecksEnabled={syntheticChecksEnabled}
                    />
                </Suspense>
            </>
        </HydrateClient>
    );
}
