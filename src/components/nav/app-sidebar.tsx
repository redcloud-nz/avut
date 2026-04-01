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

import { ModeToggle } from "./mode-toggle";
import { NavSkeleton } from "./nav-skeleton";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";

export function AppSidebar({ children, slug }: { children?: ReactNode; slug: string }) {
    return (
        <Sidebar>
            <SidebarHeader className="flex flex-row items-center justify-between border-b h-(--header-height)">
                <div className="w-[100px]">
                    <Image
                        src="/avut-logo.svg"
                        alt="A.V.U.T. Logo"
                        width={150}
                        height={50}
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
                <div className="flex items-center justify-end gap-2 px-2 py-1"></div>
                <Suspense fallback={<NavSkeleton />}>{children}</Suspense>
            </SidebarContent>
            <SidebarFooter>
                <AppVersion />
                <UserMenu slug={slug} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}

function AppVersion() {
    return (
        <div className="text-xs text-center text-muted-foreground py-1">
            {`${process.env.NEXT_PUBLIC_APP_DISPLAY_NAME} v${process.env.NEXT_PUBLIC_APP_VERSION} (${process.env.NEXT_PUBLIC_APP_VERSION_NAME})`}
        </div>
    );
}
