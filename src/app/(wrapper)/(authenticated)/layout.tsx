/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /(wrapper)/(authenticated)
 */

import Image from "next/image";
import { ReactNode, Suspense } from "react";

import { SessionWatcher } from "@/components/auth/session-watcher";
import { Std } from "@/components/blocks/std";
import { ModeToggle } from "@/components/nav/mode-toggle";
import { NotificationsMenu } from "@/components/nav/notifications-menu";
import { ScopeSidebar_Modules } from "@/components/nav/scope-sidebar-modules";
import { ScopeSwitcher, ScopeSwitcher_Skeleton } from "@/components/nav/scope-switcher";
import { SidebarPortalOutlet, SidebarPortalProvider } from "@/components/nav/sidebar-portal";
import { UserMenu, UserMenu_Skeleton } from "@/components/nav/user-menu";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from "@/components/ui/sidebar";
import { TimeZoneAutoDetect } from "@/components/user/user-settings/timezone-auto-detect";
import { WhatsNewVersionButton } from "@/components/whats-new/whats-new-button";
import {
    WhatsNewBoundary,
    WhatsNewDialog,
    WhatsNewProvider,
} from "@/components/whats-new/whats-new-dialog";
import { resolveUserModuleFlags } from "@/server/module-flags";
import { requireSession } from "@/server/session";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

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
    await requireSession();

    // `ScopeSwitcher` and `UserMenu` both read `getSession` via plain `useQuery` (not
    // suspense), so unlike `listMemberships` below it can't tolerate an unresolved prefetch —
    // a still-pending dehydrated snapshot racing the live query client's resolution is exactly
    // what produces a hydration mismatch. Awaiting costs nothing extra: `getSession` only
    // re-reads `ctx.auth`, which is `requireSession()`'s own `cache()`-wrapped lookup.
    //
    // Every authenticated page can render a date, and `DLDateDetails` reads the viewer's format
    // preference through `usePreferences()` — a `useSuspenseQuery` sitting deep inside a card
    // with no Suspense boundary of its own. Awaiting rather than `prefetch`ing is what keeps a
    // still-pending query from suspending whole card subtrees on first paint. Costs little:
    // `settings.getUserSettings` is `"use cache"`-tagged per user.
    //
    // The user modules' flag state lets the sidebar hide a flagged-off module. It runs after
    // `requireSession()`, whose request read makes the render dynamic: flag evaluation uses
    // `Math.random()`, which prerendering rejects.
    //
    // None depends on another's result, so run them concurrently rather than paying for
    // sequential round trips.
    const [, , userModuleFlags] = await Promise.all([
        fetchQuery(trpc.user.getSession.queryOptions()),
        fetchQuery(trpc.settings.getUserSettings.queryOptions()),
        resolveUserModuleFlags(),
    ]);

    // `ScopeSwitcher` reads this via `useSuspenseQuery` on every authenticated page —
    // prefetching here removes the round trip that would otherwise show as its skeleton.
    prefetch(trpc.user.listMemberships.queryOptions());

    // `WhatsNewDialog` and the version button's unseen dot both read this via `useSuspenseQuery`,
    // each inside its own `WhatsNewBoundary` (renders nothing while loading or on failure). Neither
    // is needed for first paint, so prefetch rather than await: the popup can open a moment after
    // the page does.
    prefetch(trpc.whatsNew.getUnseen.queryOptions());

    return (
        <HydrateClient>
            {/* Redirects to sign-in if the session is revoked or expires after first paint —
                see the hook's own docstring. Renders nothing. */}
            <SessionWatcher />
            {/* Adopts the browser's zone as `display.timeZone` on a user's first visit with no
                saved preference — see the component's own docstring. Renders nothing. */}
            <TimeZoneAutoDetect />
            <SidebarPortalProvider>
                <WhatsNewProvider>
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
                                <ScopeSidebar_Modules userModuleFlags={userModuleFlags} />
                                <SidebarPortalOutlet />
                            </div>
                        </SidebarContent>
                        <SidebarFooter>
                            <div className="flex justify-center text-center text-xs text-muted-foreground">
                                <WhatsNewVersionButton />
                            </div>
                            <Suspense fallback={<UserMenu_Skeleton />}>
                                <UserMenu />
                            </Suspense>
                        </SidebarFooter>
                        <SidebarRail />
                    </Sidebar>
                    {props.modal}
                    {/* Outside `<Sidebar>`: on mobile its offcanvas sheet unmounts its content while
                    closed, so a dialog in there could never open on its own. */}
                    <WhatsNewBoundary>
                        <WhatsNewDialog />
                    </WhatsNewBoundary>
                    <Std.SidebarInset>{props.children}</Std.SidebarInset>
                </WhatsNewProvider>
            </SidebarPortalProvider>
        </HydrateClient>
    );
}
