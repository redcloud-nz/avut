/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import Image from "next/image";
import { Suspense } from "react";

import { PageHelpButton } from "@/components/docs/help-button";
import { ModeToggle } from "@/components/nav/mode-toggle";
import { NotificationsMenu } from "@/components/nav/notifications-menu";
import { UserMenu, UserMenu_Skeleton } from "@/components/nav/user-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * The app's one navbar, rendered once by the authenticated layout above the page's own
 * `<Suspense>`, so it stays up while a page loads. It carries no page data: its three
 * request-dependent parts (user menu, notifications, Help) each sit in their own `<Suspense>`.
 *
 * Layout: the sidebar toggle is pinned to the header's left edge; everything else sits in a
 * centred `max-w-5xl` column (with `ScrollContainer`'s `px-4`) that lines up with
 * `Saratoga.Root` below. The side columns share the spare width equally, so the middle stays
 * centred, except when the window is too narrow to fit the toggle, which then pushes the middle
 * right rather than running underneath it. No scrollbar gutter is reserved here: the scroll
 * container reserves its gutter on both edges, so it doesn't shift the centre.
 */
export function AppNavbar() {
    return (
        <header
            data-component="AppNavbar"
            className="bg-navbar sticky top-0 grid h-(--header-height) shrink-0 grid-cols-[minmax(auto,1fr)_minmax(0,var(--container-5xl))_1fr] items-center border-b px-4 z-5 backdrop-blur-md"
        >
            {/* Keeps room for the toggle, which is positioned against the header's edge. */}
            <div aria-hidden className="w-8" />
            <div className="absolute inset-y-0 left-2 flex items-center">
                <SidebarTrigger />
            </div>
            <div className="flex min-w-0 items-center gap-1">
                <Image
                    src="/avut-logo.svg"
                    alt="A.V.U.T. Logo"
                    width={99}
                    height={33}
                    loading="eager"
                    className="mr-2 shrink-0 dark:invert"
                />
                <div className="ml-auto flex items-center gap-1">
                    <Suspense fallback={<div className="size-8" />}>
                        <NotificationsMenu />
                    </Suspense>
                    <ModeToggle />
                    <Suspense fallback={<UserMenu_Skeleton />}>
                        <UserMenu />
                    </Suspense>
                    {/* `usePathname()` suspends during prerender on routes with unknown params. */}
                    <Suspense fallback={null}>
                        <PageHelpButton />
                    </Suspense>
                </div>
            </div>
        </header>
    );
}
