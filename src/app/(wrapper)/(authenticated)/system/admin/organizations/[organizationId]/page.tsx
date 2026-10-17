/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system/admin/organizations/[organizationId]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { OrganizationId } from "@/lib/schemas/organization";
import { SystemAdmin_Organization_Content } from "@/modules/system-admin/components/organizations/organization-content";
import { resolveModuleFlags } from "@/server/module-flags";
import { requireSystemAdmin } from "@/server/system-admin-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/system/admin/organizations/[organizationId]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    await requireSystemAdmin();

    const { organizationId: raw } = await props.params;
    const organizationId = OrganizationId.schema.parse(raw);

    const organization = await fetchQuery(
        trpc.organizations.getOrganizationAsAdmin.queryOptions({ organizationId }),
    );

    return {
        title: `${organization.name} ${TITLE_SEPARATOR} Organizations`,
    };
}

export default async function SystemAdmin_Organization_Page(props: Props) {
    await requireSystemAdmin();

    const { organizationId: raw } = await props.params;
    const organizationId = OrganizationId.schema.parse(raw);

    prefetch(trpc.organizations.getOrganizationAsAdmin.queryOptions({ organizationId }));
    prefetch(trpc.organizationGroups.listGroupsForOrganization.queryOptions({ organizationId }));

    const moduleFlags = await resolveModuleFlags();

    return (
        <HydrateClient>
            <SystemAdmin_Organization_Content
                organizationId={organizationId}
                moduleFlags={moduleFlags}
            />
        </HydrateClient>
    );
}
