/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/members
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HModule_Members_SelectTeam } from "@/modules/d4h/components/members/select-team";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: `Members ${TITLE_SEPARATOR} D4H` };

/** Members are listed per team: this landing page sends the viewer on to one team's members. */
export default async function D4HModule_Members_Page(props: PageProps<"/orgs/[slug]/d4h/members">) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);

    prefetch(trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <D4HModule_Members_SelectTeam />
        </HydrateClient>
    );
}
