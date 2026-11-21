/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/bundles/[bundle_id]/teams/[d4h_team_id]/members/[member_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { I3BundleId } from "@/lib/schemas/i3-bundle";
import { D4HI3Module_BundleMemberComparison } from "@/modules/d4h-i3/components/bundles/bundle-member-comparison";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: `Member Comparison ${TITLE_SEPARATOR} D4H I3` };

/**
 * One member's row of a bundle comparison, line by line with the items that match. It reads the
 * same queries as the matrix, so without a D4H token they fail and the module's error boundary
 * explains.
 */
export default async function D4HI3Module_BundleMemberComparison_Page(
    props: PageProps<"/orgs/[slug]/d4h-i3/bundles/[bundle_id]/teams/[d4h_team_id]/members/[member_id]">,
) {
    const { slug, bundle_id, d4h_team_id, member_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const bundleId = I3BundleId.schema.parse(bundle_id);

    const teamId = Number(d4h_team_id);
    if (!Number.isInteger(teamId)) notFound();

    const memberId = Number(member_id);
    if (!Number.isInteger(memberId)) notFound();

    const organizationId = organization.id;
    prefetch(trpc.i3Bundles.getBundle.queryOptions({ organizationId, bundleId }));
    prefetch(trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId }));
    prefetch(trpc.d4hApi.listTeamMembers.queryOptions({ organizationId, teamId }));
    prefetch(trpc.d4hApi.listTeamIssuedEquipment.queryOptions({ organizationId, teamId }));
    prefetch(trpc.i3.listTemplateFits.queryOptions({ organizationId, teamId }));

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <D4HI3Module_BundleMemberComparison
                    bundleId={bundleId}
                    teamId={teamId}
                    memberId={memberId}
                />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
