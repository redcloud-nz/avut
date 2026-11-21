/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/checks
 */

import { Std } from "@/components/blocks/std";
import SkillTrack_ChecksList from "@/modules/skill-track/components/checks-list";
import {
    checkSearchInput,
    loadCheckSearchParams,
} from "@/modules/skill-track/lib/check-search-params";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: "Skill Checks",
};

export default async function SkillTrack_Checks_Page(
    props: PageProps<"/orgs/[slug]/skill-track/checks">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const params = await loadCheckSearchParams(props.searchParams);

    prefetch(trpc.skillChecks.searchChecks.queryOptions(checkSearchInput(organization.id, params)));

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <SkillTrack_ChecksList />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
