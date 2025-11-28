/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import Image from "next/image";
import { Suspense } from "react";

import {
    S2_Sidebar,
    S2_SidebarContent,
    S2_SidebarFooter,
    S2_SidebarHeader,
    S2_SidebarRail,
} from "@/components/ui/s2-sidebar";

import { NavSkeleton } from "./nav-skeleton";

export function AppSidebar({
    children,
    name,
}: {
    children?: React.ReactNode;
    name: string;
}) {
    return (
        <S2_Sidebar>
            <S2_SidebarHeader className="flex items-center justify-between border-b h-(--header-height)">
                <div className="relative h-8 aspect-2/1">
                    <Image
                        src="/logo.svg"
                        alt="RT+ logo"
                        width={400}
                        height={200}
                        priority
                    />
                </div>
            </S2_SidebarHeader>
            <S2_SidebarContent>
                <div className="w-full text-center font-semibold px-2 pt-2">
                    {/* <OrganizationSwitcher
                    appearance={{
                        elements: {
                            organizationSwitcherTrigger: 'w-[calc(var(--sidebar-width)-1px)] py-2',
                        }
                    }}
                    afterCreateOrganizationUrl="/orgs/:slug"
                    afterSelectOrganizationUrl="/orgs/:slug"
                    afterSelectPersonalUrl="/personal"
                /> */}
                    {name}
                </div>
                <Suspense fallback={<NavSkeleton />}>{children}</Suspense>
            </S2_SidebarContent>
            <S2_SidebarFooter>
                <AppVersion />
            </S2_SidebarFooter>
            <S2_SidebarRail />
        </S2_Sidebar>
    );
}

function AppVersion() {
    return (
        <div className="text-xs text-center text-muted-foreground py-1">
            RT+ v{process.env.NEXT_PUBLIC_APP_VERSION} (
            {process.env.NEXT_PUBLIC_APP_VERSION_NAME})
        </div>
    );
}
