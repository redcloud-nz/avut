/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { Metadata } from "next";
import { headers as nextHeaders } from "next/headers";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { auth } from "@/server/auth";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";
import { OrganizationProvider } from "@/hooks/use-organization";

export async function generateMetadata(props: LayoutProps<"/orgs/[slug]">): Promise<Metadata> {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return {
        title: {
            template: `%s ${TITLE_SEPARATOR} ${organization.name} | AVUT`,
            default: organization.name,
        },
    };
}

export default async function Organization_Layout(props: LayoutProps<"/orgs/[slug]">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const organizationSettings = await getOrganizationSettings(organization.id);

    const res = await auth.api.hasPermission({
        headers: await nextHeaders(),
        body: {
            permissions: {
                organization: ["view"],
            },
            organizationId: organization.id,
        },
    });
    if (!res.success) {
        throw new Error("You do not have permission to access this organization.");
    }

    return (
        <OrganizationProvider organization={organization} settings={organizationSettings}>
            {props.children}
        </OrganizationProvider>
    );
}
