/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track/reports/person
 */

import { connection } from "next/server";
import { Suspense } from "react";

import { PageLoadingSpinner } from "@/components/ui/loading";
import { syntheticChecksFlag } from "@/lib/flags";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { SkillTrack_PersonCompetencyReport } from "@/modules/skill-track/components/reports/person-competency-report";
import { requireTeam } from "@/server/team-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Personnel Competency Report`,
};

export default async function Team_SkillTrack_ReportsPersonCompetency_Page(
    props: PageProps<"/teams/[slug]/skill-track/reports/person">,
) {
    const { slug } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization } = await requireTeam(slug);
    const { person, action } = await props.searchParams;
    // Flag evaluation reads the clock, which Cache Components rejects until the render is
    // marked request-time.
    await connection();
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
            <Suspense fallback={<PageLoadingSpinner />}>
                <SkillTrack_PersonCompetencyReport
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
