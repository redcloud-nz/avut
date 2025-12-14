/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import Image from "next/image";
import { Suspense } from "react";

import { Link } from "@/components/ui/link";
import {
    S2_Sidebar,
    S2_SidebarContent,
    S2_SidebarFooter,
    S2_SidebarHeader,
    S2_SidebarRail,
} from "@/components/ui/s2-sidebar";

import * as Paths from "@/paths";

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
                <div className="w-[100px] self-center">
                    <Image
                        src="/avut-logo.svg"
                        alt="A.V.U.T. Logo"
                        width={150}
                        height={50}
                    />
                </div>
            </S2_SidebarHeader>
            <S2_SidebarContent>
                <Link
                    className="w-full text-center font-semibold px-2 pt-2"
                    to={Paths.orgs.select}
                >
                    {name}
                </Link>
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
            {`${process.env.NEXT_PUBLIC_APP_DISPLAY_NAME} v${process.env.NEXT_PUBLIC_APP_VERSION} (${process.env.NEXT_PUBLIC_APP_VERSION_NAME})`}
        </div>
    );
}
