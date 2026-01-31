/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { Metadata } from "next";
import { headers as nextHeaders } from "next/headers";

import { AppSidebar } from "@/components/nav/app-sidebar";
import { ControlBar } from "@/components/nav/control-bar";
import { NavOrganizationMenu } from "@/components/nav/nav-organization-menu";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { getOrganizationBySlug } from "@/server/organization";
import { OrganizationProvider } from "@/hooks/use-organization";
import { auth } from "@/server/auth";

export async function generateMetadata(
    props: LayoutProps<"/orgs/[slug]">,
): Promise<Metadata> {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return {
        title: {
            template: `%s ${TITLE_SEPARATOR} ${organization.name} | AVUT`,
            default: organization.name,
        },
    };
}

export default async function Organization_Layout(
    props: LayoutProps<"/orgs/[slug]">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

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
        throw new Error(
            "You do not have permission to access this organization.",
        );
    }

    return (
        <OrganizationProvider organization={organization}>
            <AppSidebar name={organization.name}>
                <NavOrganizationMenu organization={organization} />
            </AppSidebar>
            <ControlBar />
            {props.children}
        </OrganizationProvider>
    );
}
