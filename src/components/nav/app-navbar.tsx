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
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * The app's one navbar, rendered once by the authenticated layout above the page's own
 * `<Suspense>`, so it stays up while a page loads. It carries no page data: its three
 * request-dependent parts (user menu, notifications, Help) each sit in their own `<Suspense>`.
 *
 * Layout: everything sits in the page column, the same centred `max-w-5xl` that
 * `Std.ScrollContainer` gives `Saratoga.Root` below. The wrapper reserves the same scrollbar
 * gutter and padding as the scroll container, so the columns match whatever the scrollbar style.
 * The first and last icons (the glyphs, not their buttons) line up with the cards' edges: the
 * buttons overhang the column by the space around their icons.
 */
export function AppNavbar() {
    return (
        <header
            data-component="AppNavbar"
            className="bg-navbar sticky top-0 flex h-(--header-height) shrink-0 items-center border-b z-5 backdrop-blur-md"
        >
            {/* It never scrolls, but `overflow-hidden` lets it reserve a gutter. */}
            <div className="flex h-full w-full min-w-0 items-center overflow-hidden px-2 md:px-4 [scrollbar-gutter:stable]">
                <div className="mx-auto flex w-full max-w-5xl min-w-0 items-center gap-1">
                    {/* `icon-sm` (28px) around a 16px icon: 6px each side. */}
                    <SidebarTrigger className="-ml-1.5" />
                    <Separator
                        orientation="vertical"
                        className="mx-1.5 data-vertical:h-5 data-vertical:self-center"
                    />
                    <Image
                        src="/avut-logo.svg"
                        alt="A.V.U.T. Logo"
                        width={84}
                        height={28}
                        loading="eager"
                        className="shrink-0 dark:invert"
                    />
                    {/* `icon` (32px) buttons around 16px icons: 8px each side. */}
                    <div className="-mr-2 ml-auto flex items-center gap-1">
                        <Suspense fallback={<div className="size-8" />}>
                            <NotificationsMenu />
                        </Suspense>
                        <ModeToggle />
                        <Suspense fallback={<UserMenu_Skeleton />}>
                            <UserMenu />
                        </Suspense>
                        {/* Hidden while it's the last child, i.e. on pages with no help card. */}
                        <Separator
                            orientation="vertical"
                            className="mx-1 last:hidden data-vertical:h-5 data-vertical:self-center"
                        />
                        {/* `usePathname()` suspends during prerender on routes with unknown params. */}
                        <Suspense fallback={null}>
                            <PageHelpButton />
                        </Suspense>
                    </div>
                </div>
            </div>
        </header>
    );
}
