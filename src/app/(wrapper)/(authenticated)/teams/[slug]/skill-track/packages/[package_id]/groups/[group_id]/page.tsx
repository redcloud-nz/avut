/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track/packages/[package_id]/groups/[group_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { SkillTrack_SkillGroup_Content } from "@/modules/skill-track/components/group-content";
import { getTeamBySlug } from "@/server/cache/team";
import { requireTeam } from "@/server/team-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/teams/[slug]/skill-track/packages/[package_id]/groups/[group_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, package_id, group_id } = await props.params;
    // Not `requireTeam`: metadata must not redirect, and the team layout is the entry gate.
    const { organization } = await getTeamBySlug(slug);

    const skillPackageId = SkillPackageId.schema.parse(package_id);
    const skillGroupId = SkillGroupId.schema.parse(group_id);
    const group = await fetchQuery(
        trpc.skillPackageSubscriptions.getGroup.queryOptions({
            organizationId: organization.id,
            skillPackageId,
            skillGroupId,
        }),
    );

    return { title: `${group.name} ${TITLE_SEPARATOR} ${group.skillPackage.name}` };
}

export default async function Team_SkillTrack_SkillGroup_Page(props: Props) {
    const { slug, package_id, group_id } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization } = await requireTeam(slug);

    const skillPackageId = SkillPackageId.schema.parse(package_id);
    const skillGroupId = SkillGroupId.schema.parse(group_id);

    prefetch(
        trpc.skillPackageSubscriptions.getGroup.queryOptions({
            organizationId: organization.id,
            skillPackageId,
            skillGroupId,
        }),
    );

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <SkillTrack_SkillGroup_Content
                    skillPackageId={skillPackageId}
                    skillGroupId={skillGroupId}
                />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
