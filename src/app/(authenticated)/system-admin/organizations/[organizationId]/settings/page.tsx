/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system-admin/organizations/[organizationId]/settings
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SystemAdmin_OrganizationSettings_Content } from "@/components/system-admin/organizations/organization-settings-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { OrganizationId } from "@/lib/schemas/organization";
import { requireGlobalAdmin } from "@/server/system-admin-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/system-admin/organizations/[organizationId]/settings">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    await requireGlobalAdmin();

    const { organizationId: raw } = await props.params;
    const organizationId = OrganizationId.schema.parse(raw);

    const organization = await fetchQuery(
        trpc.systemAdmin.getOrganization.queryOptions({ organizationId }),
    );

    return {
        title: `Settings ${TITLE_SEPARATOR} ${organization.name}`,
    };
}

export default async function SystemAdmin_OrganizationSettings_Page(props: Props) {
    await requireGlobalAdmin();

    const { organizationId: raw } = await props.params;
    const organizationId = OrganizationId.schema.parse(raw);

    prefetch(trpc.systemAdmin.getOrganization.queryOptions({ organizationId }));
    prefetch(trpc.systemAdmin.getOrganizationSettings.queryOptions({ organizationId }));

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SystemAdmin_OrganizationSettings_Content organizationId={organizationId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
