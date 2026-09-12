/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /
 */

import Image from "next/image";
import { ReactNode, Suspense } from "react";

import { AppProviders } from "@/components/providers/app-providers";
import { ModeToggle } from "@/components/nav/mode-toggle";
import { NavSkeleton } from "@/components/nav/nav-skeleton";
import { NotificationsMenu } from "@/components/nav/notifications-menu";
import { UserMenu } from "@/components/nav/user-menu";
import { ImpersonationBanner } from "@/components/system-admin/impersonation-banner";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar";
import { VersionString } from "@/components/ui/version-string";
import { ensureSession } from "@/server/auth-queries";
import { requireSession } from "@/server/session";
import { getServerQueryClient, HydrateClient } from "@/trpc/server";

// This layout used to carry `export const instant = { unstable_disableValidation: true }` to
// suppress E1437 for the whole authenticated subtree, because `requireSession()` below is a
// blocking request read. That suppression is no longer needed: `(wrapper)/loading.tsx` now sits
// above this layout, so the read happens *inside* a Suspense boundary and validation is
// satisfied honestly. Verified by removing that file — the build then fails on every
// `/orgs/[slug]/…` route. Keep the two facts together: this layout may block only for as long
// as a boundary stays above it.
export default async function AuthenticatedLayout(props: {
    modal: ReactNode;
    sidebar: ReactNode;
    children: ReactNode;
}) {
    // Baseline guard for every authenticated route. The proxy only checks that a session
    // cookie is *present*; this is the check that actually validates it.
    await requireSession();

    // Seed the session into the request-scoped cache once, here, so every client
    // `useSession()` below renders it on first paint with no fetch on mount.
    await ensureSession(getServerQueryClient());

    return (
        <HydrateClient>
            <AppProviders>
                <ImpersonationBanner />
                {/*
                 * PROTOTYPE — this used to be a separate `ModuleSidebar` component, rendered
                 * inside `orgs/[slug]/layout.tsx`, `system-admin/layout.tsx`, and
                 * `notes/layout.tsx`. It's inlined here so every authenticated route shares one
                 * sidebar shell; the `@sidebar` slot (mirroring the main tree's structure under
                 * this same directory) supplies the per-route menu content. See the
                 * suspense-boundary-review discussion for the tradeoffs.
                 */}
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
                            <VersionString />
                        </div>
                        <UserMenu />
                    </SidebarFooter>
                    <SidebarRail />
                </Sidebar>
                {props.modal}
                {props.children}
            </AppProviders>
        </HydrateClient>
    );
}
