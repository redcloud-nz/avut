/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/i3/d4h-tasks
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { I3Module_D4HTasks_List } from "@/modules/i3/components/d4h-tasks-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: `D4H Tasks ${TITLE_SEPARATOR} I3` };

export default async function I3Module_D4HTasks_Page(
    props: PageProps<"/orgs/[slug]/i3/d4h-tasks">,
) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    prefetch(trpc.d4hTasks.listOpenTasks.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <I3Module_D4HTasks_List />
        </HydrateClient>
    );
}
