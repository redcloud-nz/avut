/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Std page shell components.
 *
 * The outer shell for a page within a sidebar layout: the page column beside the sidebar
 * (with the layout's `AppNavbar` above it), a scrollable main content area, and nav-list
 * index pages. Breadcrumb trails live in the page itself, not here.
 */

import { ComponentProps, ReactNode, Suspense } from "react";

import { GlyphPage } from "@/components/glyph-page";
import { PageBackground, pageBackgroundAttributes } from "@/components/page-background";
import { PageLoadingSpinner, RainbowSpinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

/**
 * The page column beside the sidebar. `navbar` renders above the page's `<Suspense>`, so it
 * stays up while the page loads.
 */
function SidebarInset({ children, navbar }: { children: ReactNode; navbar?: ReactNode }) {
    return (
        <div
            data-component="StdSidebarInset"
            {...pageBackgroundAttributes}
            // `isolate` makes this the stacking context the page background sits at the bottom of.
            className="relative isolate flex w-full min-w-0 h-[calc(100svh-var(--impersonation-h))] flex-1 flex-col bg-page"
        >
            <PageBackground />
            {navbar}
            <Suspense fallback={<PageLoadingSpinner />}>{children}</Suspense>
        </div>
    );
}

function ScrollContainer({ children, className, ...props }: ComponentProps<"main">) {
    return (
        <Suspense
            fallback={
                <main
                    className={cn(
                        "flex items-center justify-center flex-1 px-2 py-4 md:px-4",
                        className,
                    )}
                    data-slot="scroll-container"
                    {...props}
                >
                    <RainbowSpinner />
                </main>
            }
        >
            <main
                className={cn(
                    "relative flex-1 px-2 py-4 md:px-4 overflow-y-auto [scrollbar-color:var(--scrollbar-thumb)_var(--scrollbar-track)] [scrollbar-gutter:stable]",
                    className,
                )}
                data-slot="scroll-container"
                {...props}
            >
                {children}
            </main>
        </Suspense>
    );
}

/**
 * A nav-list page: `title` above a list of links. No trail and no logo: the navbar carries the
 * logo, and the sidebar is the way back up.
 */
function IndexPage({
    children,
    className,
    title,
    ...props
}: ComponentProps<"div"> & { title: string }) {
    return (
        <div
            data-slot="std-index-page"
            className={cn("w-full sm:w-lg sm:mx-auto", className)}
            {...props}
        >
            {/* Index pages are low-traffic, so they show the glyph background. */}
            <GlyphPage />
            {/* Sized to its content so the glyph halo hugs the title. */}
            <div className="glyph-halo mx-auto my-4 w-fit font-semibold">{title}</div>
            {children}
        </div>
    );
}

export const Std = {
    SidebarInset,
    ScrollContainer,
    IndexPage,
};
