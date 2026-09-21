/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/reports/person
 */

import { Suspense } from "react";

import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { SkillTrack_PersonCompetencyReport } from "@/components/skill-track/reports/person-competency-report";
import { PageLoadingSpinner } from "@/components/ui/loading";
import { syntheticChecksFlag } from "@/lib/flags";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { getOrganizationBySlug } from "@/server/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Personnel Competency Report`,
};

export default async function SkillTrack_ReportsPersonCompetency_Page(
    props: PageProps<"/orgs/[slug]/skill-track/reports/person">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const { person, action } = await props.searchParams;
    const syntheticChecksEnabled = await syntheticChecksFlag();

    const parsedPersonId =
        typeof person === "string" ? PersonId.schema.safeParse(person) : undefined;

    // Only the scope dialog lists personnel, and it only fetches them once it's open. It opens on
    // arrival when no valid person is picked yet (`forceOpen`) or via `?action=select-scope`;
    // otherwise the list isn't needed until the user opens it, so don't pay for it here.
    if (!parsedPersonId?.success || action === "select-scope") {
        prefetch(trpc.personnel.listPersonnel.queryOptions({ organizationId: organization.id }));
    }

    // Only prefetch the competency matrix for a well-formed person id — an invalid `?person=`
    // falls back to the picker client-side, so fetching a matrix here is wasted work.
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
            <>
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
                    actions={<HelpButton slug="skill-track/reports" />}
                />
                <Suspense fallback={<PageLoadingSpinner />}>
                    <SkillTrack_PersonCompetencyReport
                        syntheticChecksEnabled={syntheticChecksEnabled}
                    />
                </Suspense>
            </>
        </HydrateClient>
    );
}
