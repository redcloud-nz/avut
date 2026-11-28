/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /teams/[slug]/skill-track/packages/[package_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { SkillTrack_Package_Content } from "@/modules/skill-track/components/package-content";
import { getTeamBySlug } from "@/server/cache/team";
import { requireTeam } from "@/server/team-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/teams/[slug]/skill-track/packages/[package_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, package_id } = await props.params;
    // Not `requireTeam`: metadata must not redirect, and the team layout is the entry gate.
    const { organization } = await getTeamBySlug(slug);

    const skillPackageId = SkillPackageId.schema.parse(package_id);
    const skillPackage = await fetchQuery(
        trpc.skillPackageSubscriptions.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId,
        }),
    );

    return { title: `${skillPackage.name} ${TITLE_SEPARATOR} Packages` };
}

export default async function Team_SkillTrack_Package_Page(props: Props) {
    const { slug, package_id } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization } = await requireTeam(slug);

    const skillPackageId = SkillPackageId.schema.parse(package_id);

    prefetch(
        trpc.skillPackageSubscriptions.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId,
        }),
    );

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <SkillTrack_Package_Content skillPackageId={skillPackageId} />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
