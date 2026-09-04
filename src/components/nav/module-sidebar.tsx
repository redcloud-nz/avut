/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import Image from "next/image";
import { ReactNode, Suspense } from "react";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar";

import { VersionString } from "@/components/ui/version-string";

import { ModuleListMenu } from "./module-list-menu";
import { ModeToggle } from "./mode-toggle";
import { NavSkeleton } from "./nav-skeleton";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";

export function ModuleSidebar({
    children,
    scope,
}: {
    children?: ReactNode;
    scope: "global" | "organization";
}) {
    return (
        <Sidebar>
            <SidebarHeader className="flex flex-row items-center justify-between border-b h-(--header-height)">
                <div className="w-[100px]">
                    <Image
                        src="/avut-logo.svg"
                        alt="A.V.U.T. Logo"
                        width={100}
                        height={100 / 3}
                        loading="eager"
                        className="dark:invert"
                    />
                </div>
                <div>
                    <NotificationsMenu />
                    <ModeToggle />
                </div>
            </SidebarHeader>
            <SidebarContent>
                <ModuleListMenu scope={scope} />
                <Suspense fallback={<NavSkeleton />}>{children}</Suspense>
            </SidebarContent>
            <SidebarFooter>
                <div className="py-1 text-center text-xs text-muted-foreground">
                    <VersionString />
                </div>
                <UserMenu />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
