/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { getOrganizationBySlug } from "@/server/organization";
import { requireOrganization } from "@/server/organization-access";
import { OrganizationProvider } from "@/hooks/use-organization";

// NOTE: metadata generation deliberately uses the plain cached lookup rather than
// `requireOrganization` — `generateMetadata` must not redirect. The access check lives in
// the layout below, which is what actually gates rendering.
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
    const { organization, settings, roles } = await requireOrganization(slug);

    return (
        <OrganizationProvider organization={organization} settings={settings} roles={roles}>
            {props.children}
        </OrganizationProvider>
    );
}
