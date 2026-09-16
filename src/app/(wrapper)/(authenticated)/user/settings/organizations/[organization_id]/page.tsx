/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/settings/organizations/[organization_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { UserSettings_OrganizationContent } from "@/components/user-settings/organization-content";

import { OrganizationId } from "@/lib/schemas/organization";
import { fetchQuery, HydrateClient, trpc } from "@/trpc/server";

type Props = PageProps<"/user/settings/organizations/[organization_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { organization_id } = await props.params;
    const organizationId = OrganizationId.schema.parse(organization_id);

    const memberships = await fetchQuery(trpc.users.listMemberships.queryOptions());
    const membership = memberships.find((m) => m.organization.id === organizationId);

    return { title: membership?.organization.name ?? "Organisation" };
}

export default async function UserSettings_Organization_Page(props: Props) {
    const { organization_id } = await props.params;
    const organizationId = OrganizationId.schema.parse(organization_id);

    const memberships = await fetchQuery(trpc.users.listMemberships.queryOptions());
    if (!memberships.some((m) => m.organization.id === organizationId)) notFound();

    return (
        <HydrateClient>
            <UserSettings_OrganizationContent organizationId={organizationId} />
        </HydrateClient>
    );
}
