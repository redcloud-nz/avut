/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/reports/person/[person_id]
 */

import { Std } from "@/components/blocks/std";
import { SkillTrack_PersonCompetencyReport } from "@/components/skill-track/reports/person-competency-report";

import { PersonId } from "@/lib/schemas/person";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Personnel Competency`,
};

export default async function SkillTrack_ReportsPersonCompetency_Page(
    props: PageProps<"/orgs/[slug]/skill-track/reports/person/[person_id]">,
) {
    const { slug, person_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    // `?synthetic` replaces the recorded competencies with generated ones — see
    // synthetic-competency-data.
    const { synthetic } = await props.searchParams;

    const personId = PersonId.schema.parse(person_id);

    prefetch(
        trpc.skillChecks.getCompetencyMatrix.queryOptions({
            organizationId: organization.id,
            personId,
        }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SkillTrack_PersonCompetencyReport
                    personId={personId}
                    synthetic={synthetic !== undefined}
                />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
