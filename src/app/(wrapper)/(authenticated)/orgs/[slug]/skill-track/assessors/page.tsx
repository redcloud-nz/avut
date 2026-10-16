/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/assessors
 */

import { Std } from "@/components/blocks/std";
import { route } from "@/lib/routes";
import { SkillTrack_AssessorsList } from "@/modules/skill-track/components/assessors-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: "Assessors",
};

export default async function SkillTrack_Assessors_Page(
    props: PageProps<"/orgs/[slug]/skill-track/assessors">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    prefetch(
        trpc.organizations.listMembersForRoleGrant.queryOptions({
            organizationId: organization.id,
            role: "skills-assessor",
        }),
    );

    return (
        <HydrateClient>
            <>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
                        {
                            label: "Assessors",
                            href: route("/orgs/[slug]/skill-track/assessors", { slug }),
                        },
                    ]}
                />
                <Std.ScrollContainer>
                    <SkillTrack_AssessorsList />
                </Std.ScrollContainer>
            </>
        </HydrateClient>
    );
}
