/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /i3/[slug]
 */

import {
    EyeIcon,
    SquareArrowRightEnterIcon,
    SquareArrowRightExitIcon,
} from "lucide-react";
import { Metadata } from "next";
import { headers as nextHeaders } from "next/headers";

import { AppSidebar } from "@/components/nav/app-sidebar";
import { ControlBar } from "@/components/nav/control-bar";
import { NavItem } from "@/components/nav/nav-section";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import { OrganizationProvider } from "@/hooks/use-organization";
import { TITLE_SEPARATOR } from "@/lib/constants";
import * as Paths from "@/paths";
import { auth } from "@/server/auth";
import { getOrganizationBySlug } from "@/server/organization";

export async function generateMetadata(
    props: LayoutProps<"/i3/[slug]">,
): Promise<Metadata> {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return {
        title: `I3 ${TITLE_SEPARATOR} ${organization.name} | AVUT`,
    };
}

export default async function I3_Layout(props: LayoutProps<"/i3/[slug]">) {
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
            <AppSidebar
                appName={<div className="flex text-2xl">I3</div>}
                name={organization.name}
            >
                <SidebarGroup>
                    <SidebarMenu>
                        <NavItem
                            path={Paths.i3(organization.slug).inspect}
                            icon={<EyeIcon />}
                            size="lg"
                        />
                        <NavItem
                            path={Paths.i3(organization.slug).issue}
                            icon={<SquareArrowRightExitIcon />}
                            size="lg"
                        />
                        <NavItem
                            path={Paths.i3(organization.slug).return}
                            icon={<SquareArrowRightEnterIcon />}
                            size="lg"
                        />
                    </SidebarMenu>
                </SidebarGroup>
            </AppSidebar>
            <ControlBar />
            {props.children}
        </OrganizationProvider>
    );
}
