/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]
 */

import { Metadata } from "next";
import { headers as nextHeaders } from "next/headers";

import { AppSidebar } from "@/components/nav/app-sidebar";
import { ControlBar } from "@/components/nav/control-bar";

import { OrganizationProvider } from "@/hooks/use-organization";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { auth } from "@/server/auth";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

import { MainApp_Sidebar_Menu } from "./sidebar-menu";

export async function generateMetadata(props: LayoutProps<"/main/[slug]">): Promise<Metadata> {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return {
        title: {
            template: `%s ${TITLE_SEPARATOR} ${organization.name} | AVUT`,
            default: organization.name,
        },
    };
}

export default async function MainApp_Layout(props: LayoutProps<"/main/[slug]">) {
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
            <AppSidebar>
                <MainApp_Sidebar_Menu organization={organization} settings={organizationSettings} />
            </AppSidebar>
            <ControlBar slug={slug} />
            {props.children}
        </OrganizationProvider>
    );
}
