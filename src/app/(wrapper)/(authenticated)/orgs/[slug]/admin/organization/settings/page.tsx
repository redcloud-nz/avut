/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/settings/--update
 */

import { AdminModule_Settings_Content } from "@/components/admin-settings/settings-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function AdminModule_Settings_Page(
    props: PageProps<`/orgs/[slug]/admin/organization/settings`>,
) {
    const organization = await getOrganizationBySlug((await props.params).slug);

    prefetch(
        trpc.settings.getOrganizationSettings.queryOptions({ organizationId: organization.id }),
    );

    return (
        <HydrateClient>
            <AdminModule_Settings_Content />
        </HydrateClient>
    );
}
