/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/reports/person
 */

import { Suspense } from "react";

import { Std } from "@/components/blocks/std";
import { SkillTrack_PersonCompetencyReport } from "@/components/skill-track/reports/person-competency-report";
import { PageLoadingSpinner } from "@/components/ui/loading";

import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Personnel Competency`,
};

export default async function SkillTrack_ReportsPersonCompetency_Page(
    props: PageProps<"/orgs/[slug]/skill-track/reports/person">,
) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);
    const { person } = await props.searchParams;

    prefetch(trpc.personnel.listPersonnel.queryOptions({ organizationId: organization.id }));

    // Only prefetch the competency matrix for a well-formed person id — an invalid `?person=`
    // falls back to the picker client-side, so fetching a matrix here is wasted work.
    const parsedPersonId =
        typeof person === "string" ? PersonId.schema.safeParse(person) : undefined;
    if (parsedPersonId?.success) {
        prefetch(
            trpc.skillChecks.getCompetencyMatrix.queryOptions({
                organizationId: organization.id,
                personId: parsedPersonId.data,
            }),
        );
    }

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <Std.Navbar
                    breadcrumbs={[
                        {
                            label: "Skill Track",
                            href: route("/orgs/[slug]/skill-track", { slug }),
                        },
                        {
                            label: "Reports",
                            href: route("/orgs/[slug]/skill-track/reports", { slug }),
                        },
                        {
                            label: "Personnel Competency",
                            href: route("/orgs/[slug]/skill-track/reports/person", { slug }),
                        },
                    ]}
                />
                <Suspense fallback={<PageLoadingSpinner />}>
                    <SkillTrack_PersonCompetencyReport />
                </Suspense>
            </Std.SidebarInset>
        </HydrateClient>
    );
}
