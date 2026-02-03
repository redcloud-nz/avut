/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /pub/[slug]
 */

import { AppSidebar } from "@/components/nav/app-sidebar";
import { OrganizationProvider } from "@/hooks/use-organization";
import { TITLE_SEPARATOR } from "@/lib/constants";
import {
    getAllOrganizationSlugs,
    getOrganizationBySlug,
} from "@/server/organization";

import { Providers } from "../../../(authenticated)/providers";

export async function generateStaticParams() {
    const slugs = await getAllOrganizationSlugs();
    return slugs.map((slug) => ({ slug }));
}

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

export default async function Pub_Organization_Layout(
    props: LayoutProps<`/pub/orgs/[slug]`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Providers>
            <OrganizationProvider organization={organization}>
                <AppSidebar name={organization.name}></AppSidebar>
                {props.children}
            </OrganizationProvider>
        </Providers>
    );
}
