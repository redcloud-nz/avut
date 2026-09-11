/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/settings/--update
 */

import { Std } from "@/components/blocks/std";

import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { AdminModule_Settings_Content } from "@/components/admin-settings/settings-content";

export default async function AdminModule_Settings_Page(
    props: PageProps<`/orgs/[slug]/admin/organization/settings`>,
) {
    const { organization } = await requireOrganization((await props.params).slug);

    prefetch(
        trpc.settings.getOrganizationSettings.queryOptions({ organizationId: organization.id }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <AdminModule_Settings_Content />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
