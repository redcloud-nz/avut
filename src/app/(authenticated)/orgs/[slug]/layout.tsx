/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { Metadata } from "next";

import { AppSidebar } from "@/components/nav/app-sidebar";
import { ControlBar } from "@/components/nav/control-bar";
import { NavOrganizationMenu } from "@/components/nav/nav-organization-menu";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { getOrganizationBySlug } from "@/server/organization";
import { OrganizationProvider } from "@/hooks/use-organization";

export async function generateMetadata(
    props: LayoutProps<"/orgs/[slug]">,
): Promise<Metadata> {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return {
        title: {
            template: `%s ${TITLE_SEPARATOR} ${organization.name}`,
            default: organization.name,
        },
    };
}

export default async function Organization_Layout(
    props: LayoutProps<"/orgs/[slug]">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <OrganizationProvider organization={organization}>
            <AppSidebar name={organization.name}>
                <NavOrganizationMenu organization={organization} />
            </AppSidebar>
            <ControlBar organization={organization} />
            {props.children}
        </OrganizationProvider>
    );
}
