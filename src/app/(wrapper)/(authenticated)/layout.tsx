/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /(wrapper)/(authenticated)
 */

import Image from "next/image";
import { ReactNode, Suspense } from "react";

import { AppProviders } from "@/components/providers/app-providers";
import { Std } from "@/components/blocks/std";
import { ModeToggle } from "@/components/nav/mode-toggle";
import { NavSkeleton } from "@/components/nav/nav-skeleton";
import { NotificationsMenu } from "@/components/nav/notifications-menu";
import { UserMenu } from "@/components/nav/user-menu";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar";
import { VersionString } from "@/components/ui/version-string";
import { requireSession } from "@/server/session";
import { getServerQueryClient, HydrateClient } from "@/trpc/server";
import { authQueryKeys } from "@/lib/auth-query-keys";

// `requireSession()` below is a blocking request read, and every authenticated route still
// reports uncached-data-during-navigation despite `(wrapper)/loading.tsx` sitting above this
// layout — the boundary covers the initial prerender's static shell, not client-side
// navigations between authenticated routes, which is what `instant` validation actually checks.
// Suppress it here rather than fight it per-route: session data is inherently per-request and
// security-sensitive, so it isn't a good `"use cache"` candidate, and every route under this
// layout already blocks on it.
export const instant = false;

export default async function AuthenticatedLayout(props: {
    modal: ReactNode;
    sidebar: ReactNode;
    children: ReactNode;
}) {
    // Baseline guard for every authenticated route. The proxy only checks that a session
    // cookie is *present*; this is the check that actually validates it.
    const session = await requireSession();

    const queryClient = getServerQueryClient();
    queryClient.setQueryData(authQueryKeys.session, session);

    return (
        <HydrateClient>
            <AppProviders>
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
                        <Suspense fallback={<NavSkeleton />}>{props.sidebar}</Suspense>
                    </SidebarContent>
                    <SidebarFooter>
                        <div className="py-1 text-center text-xs text-muted-foreground">
                            <VersionString layout="stacked" />
                        </div>
                        <UserMenu />
                    </SidebarFooter>
                    <SidebarRail />
                </Sidebar>
                {props.modal}
                <Std.SidebarInset>{props.children}</Std.SidebarInset>
            </AppProviders>
        </HydrateClient>
    );
}
