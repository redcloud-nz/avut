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
import { getTranslations } from "next-intl/server";

import { AppSidebar } from "@/components/nav/app-sidebar";
import { ControlBar } from "@/components/nav/control-bar";
import { NavItem } from "@/components/nav/nav-section";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import { OrganizationProvider } from "@/hooks/use-organization";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { auth } from "@/server/auth";
import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

export async function generateMetadata(
    props: LayoutProps<"/i3/[slug]">,
): Promise<Metadata> {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return {
        title: `I3 ${TITLE_SEPARATOR} ${organization.name} | AVUT`,
    };
}

export default async function I3App_Layout(props: LayoutProps<"/i3/[slug]">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const organizationSettings = await getOrganizationSettings(organization.id);
    const t = await getTranslations("I3App");

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
        <OrganizationProvider
            organization={organization}
            settings={organizationSettings}
        >
            <AppSidebar subappId="i3" slug={slug}>
                <SidebarGroup>
                    <SidebarMenu>
                        <NavItem
                            label={t("inspect")}
                            href={`/i3/${slug}/inspect`}
                            icon={<EyeIcon />}
                            size="lg"
                        />
                        <NavItem
                            label={t("issue")}
                            href={`/i3/${slug}/issue`}
                            icon={<SquareArrowRightExitIcon />}
                            size="lg"
                        />
                        <NavItem
                            label={t("return")}
                            href={`/i3/${slug}/return`}
                            icon={<SquareArrowRightEnterIcon />}
                            size="lg"
                        />
                    </SidebarMenu>
                </SidebarGroup>
            </AppSidebar>
            <ControlBar subappId="i3" slug={slug} />
            {props.children}
        </OrganizationProvider>
    );
}
