/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import Image from "next/image";
import Link from "next/link";
import { ReactNode, Suspense } from "react";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar";

import { SubappId, Subapps } from "@/lib/subapp";

import { NavSkeleton } from "./nav-skeleton";

export function AppSidebar({
    children,
    slug,
    subappId,
}: {
    children?: ReactNode;
    slug: string;
    subappId?: SubappId;
}) {
    return (
        <Sidebar>
            <SidebarHeader className="flex flex-row items-center justify-evenly border-b h-(--header-height)">
                <div className="w-[100px] self-center">
                    <Image
                        src="/avut-logo.svg"
                        alt="A.V.U.T. Logo"
                        width={150}
                        height={50}
                        loading="eager"
                        className="dark:invert"
                    />
                </div>
            </SidebarHeader>
            <SidebarContent>
                {subappId && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="text-sm">
                                {Subapps[subappId].name}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>Switch App</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/i3/${slug}`}>AVUT - I3</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href={`/main/${slug}`}>AVUT - Main</Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                <Suspense fallback={<NavSkeleton />}>{children}</Suspense>
            </SidebarContent>
            <SidebarFooter>
                <AppVersion />
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
