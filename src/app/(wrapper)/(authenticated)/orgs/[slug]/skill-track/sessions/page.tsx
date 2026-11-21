/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions
 */

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import SkillTrack_Sessions_List from "@/modules/skill-track/components/sessions-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Skill Check Sessions ${TITLE_SEPARATOR} Skills Module`,
};

export default async function SkillTrack_Sessions_Page(
    props: PageProps<"/orgs/[slug]/skill-track/sessions">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    prefetch(
        trpc.skillCheckSessions.listSessions.queryOptions({ organizationId: organization.id }),
    );

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <SkillTrack_Sessions_List />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
