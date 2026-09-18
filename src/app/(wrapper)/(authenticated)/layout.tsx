/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /(wrapper)/(authenticated)
 */

import Image from "next/image";
import { ReactNode, Suspense } from "react";

import { Std } from "@/components/blocks/std";
import { ModeToggle } from "@/components/nav/mode-toggle";
import { NotificationsMenu } from "@/components/nav/notifications-menu";
import { ScopeSidebar_Modules } from "@/components/nav/scope-sidebar-modules";
import { ScopeSwitcher, ScopeSwitcher_Skeleton } from "@/components/nav/scope-switcher";
import { SidebarPortalOutlet, SidebarPortalProvider } from "@/components/nav/sidebar-portal";
import { UserMenu } from "@/components/nav/user-menu";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar";
import { VersionString } from "@/components/ui/version-string";
import { serverSessionQueryOptions } from "@/server/auth-queries";
import { requireSession } from "@/server/session";
import { getServerQueryClient, HydrateClient, prefetch, trpc } from "@/trpc/server";

// `requireSession()` below is a blocking request read. `(wrapper)/loading.tsx` sitting above
// this layout satisfies *build-time* prerender validation for it (see that file's docstring),
// but not *runtime* instant-navigation validation for client-side navigations between
// authenticated routes — that's a separate check this suppresses directly. Suppress it here
// rather than fight it per-route: session data is inherently per-request and
// security-sensitive, so it isn't a good `"use cache"` candidate, and every route under this
// layout already blocks on it.
export const instant = false;

export default async function AuthenticatedLayout(props: {
    modal: ReactNode;
    children: ReactNode;
}) {
    // Baseline guard for every authenticated route. The proxy only checks that a session
    // cookie is *present*; this is the check that actually validates it.
    const session = await requireSession();

    const queryClient = getServerQueryClient();
    queryClient.setQueryData(serverSessionQueryOptions().queryKey, session);

    // `ScopeSwitcher` reads this via a client `useQuery` on every authenticated page —
    // prefetching here removes the round trip that would otherwise show as its skeleton.
    prefetch(trpc.users.listMemberships.queryOptions());

    return (
        <HydrateClient>
            <SidebarPortalProvider>
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
                    <SidebarContent className="overflow-hidden">
                        <div className="px-1 pt-1">
                            <Suspense fallback={<ScopeSwitcher_Skeleton />}>
                                <ScopeSwitcher />
                            </Suspense>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--scrollbar-thumb)_var(--scrollbar-track)] [scrollbar-gutter:stable]">
                            <ScopeSidebar_Modules />
                            <SidebarPortalOutlet />
                        </div>
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
            </SidebarPortalProvider>
        </HydrateClient>
    );
}
