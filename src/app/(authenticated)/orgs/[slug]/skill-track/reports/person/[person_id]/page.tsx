/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/reports/person/[person_id]
 */

import { Std } from "@/components/blocks/std";
import { SkillTrack_PersonCompetencyReport } from "@/components/skill-track/reports/person-competency-report";

import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { requireOrganization } from "@/server/organization-access";

export const metadata = {
    title: `Personnel Competency`,
};

export default async function SkillTrack_ReportsPersonCompetency_Page(
    props: PageProps<"/orgs/[slug]/skill-track/reports/person/[person_id]">,
) {
    const { slug, person_id } = await props.params;
    await requireOrganization(slug);

    // `?synthetic` replaces the recorded competencies with generated ones — see
    // synthetic-competency-data.
    const { synthetic } = await props.searchParams;

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
                    {
                        label: "Reports",
                        href: route("/orgs/[slug]/skill-track/reports", { slug }),
                    },
                    {
                        label: "Personnel Competency",
                        href: route("/orgs/[slug]/skill-track/reports/person", { slug }),
                    },
                    "Report",
                ]}
            />
            <Std.ScrollContainer>
                <SkillTrack_PersonCompetencyReport
                    personId={person_id as PersonId}
                    synthetic={synthetic !== undefined}
                />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
