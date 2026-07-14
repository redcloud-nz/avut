/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /pub/[slug]
 */

import { ModuleSidebar } from "@/components/nav/module-sidebar";
import { OrganizationProvider } from "@/hooks/use-organization";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { getOrganizationBySlug } from "@/server/organization";

import { CommonProviders } from "@/components/providers";
import { getOrganizationSettings } from "@/server/organization-settings";

export async function generateMetadata(props: LayoutProps<`/pub/orgs/[slug]`>) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return {
        title: {
            template: `%s ${TITLE_SEPARATOR} ${organization.name} | AVUT`,
            default: organization.name,
        },
    };
}

export default async function Pub_Organization_Layout(props: LayoutProps<`/pub/orgs/[slug]`>) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const organizationSettings = await getOrganizationSettings(organization.id);

    return (
        <CommonProviders>
            <OrganizationProvider organization={organization} settings={organizationSettings}>
                <ModuleSidebar slug={slug}></ModuleSidebar>
                {props.children}
            </OrganizationProvider>
        </CommonProviders>
    );
}
