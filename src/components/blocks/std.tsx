/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Std page shell components.
 *
 * The outer shell for a page within a sidebar layout: the layout's navbar above a
 * scrollable main content area.
 */

import type { Route } from "next";
import Link from "next/link";
import { ComponentProps, Fragment, ReactNode, Suspense } from "react";

import { AVUTLogo } from "@/components/art/avut-logo";
import { GlyphPage } from "@/components/glyph-page";
import { PageBackground, pageBackgroundAttributes } from "@/components/page-background";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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

type BreadcrumbItem = {
    label: string;
    href?: Route;
};

function normalizeBreadcrumbs(breadcrumbs: (BreadcrumbItem | string)[]): BreadcrumbItem[] {
    return breadcrumbs.map((breadcrumb) =>
        typeof breadcrumb === "string" ? { label: breadcrumb } : breadcrumb,
    );
}

interface BreadcrumbsProps {
    breadcrumbs?: (BreadcrumbItem | string)[];
}

function Breadcrumbs({ breadcrumbs = [] }: BreadcrumbsProps) {
    const normalizedBreadcrumbs = normalizeBreadcrumbs(breadcrumbs);
    const ancestors = normalizedBreadcrumbs.slice(0, -1);
    const current = normalizedBreadcrumbs[normalizedBreadcrumbs.length - 1];
    // Mobile shows a single crumb: the nearest ancestor with somewhere to go. The
    // leaf is dropped, since the page's own title repeats it.
    const primary = ancestors.findLast((breadcrumb) => breadcrumb.href);

    return (
        <Breadcrumb className="px-2 max-md:min-w-0">
            <BreadcrumbList className="flex-nowrap">
                {primary?.href && (
                    <BreadcrumbItem className="min-w-0 md:hidden">
                        <BreadcrumbLink asChild>
                            <Link href={primary.href} className="truncate">
                                {primary.label}
                            </Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                )}

                {/* Desktop: full inline trail. */}
                {ancestors.map((breadcrumb, idx) => (
                    <Fragment key={idx}>
                        <BreadcrumbItem className="hidden md:block">
                            {breadcrumb.href ? (
                                <BreadcrumbLink asChild>
                                    <Link href={breadcrumb.href}>{breadcrumb.label}</Link>
                                </BreadcrumbLink>
                            ) : (
                                <span className="text-muted-foreground">{breadcrumb.label}</span>
                            )}
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="hidden md:block" />
                    </Fragment>
                ))}
                {/* No linked ancestor: the leaf stands in on mobile too. */}
                <BreadcrumbItem className={primary ? "hidden md:block" : undefined}>
                    <BreadcrumbPage>{current.label}</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );
}

type NavbarProps =
    | {
          breadcrumbs?: (BreadcrumbItem | string)[];
          children?: never;
      }
    | { children?: ReactNode; breadcrumbs?: never };

/**
 * @deprecated The app's navbar is now `AppNavbar`, rendered once by the authenticated layout.
 * During the move of breadcrumbs into the page, this renders only a plain in-flow breadcrumb
 * strip, so unconverted pages don't show two bars. It goes once no page uses it.
 */
function Navbar({ breadcrumbs, children }: NavbarProps) {
    return (
        <div className="flex shrink-0 items-center gap-1 px-2 py-1">
            {breadcrumbs && <Breadcrumbs breadcrumbs={breadcrumbs} />}
            {children}
        </div>
    );
}

function ScrollContainer({ children, className, ...props }: ComponentProps<"main">) {
    return (
        <Suspense
            fallback={
                <main
                    className={cn("flex items-center justify-center flex-1 p-4", className)}
                    data-slot="scroll-container"
                    {...props}
                >
                    <RainbowSpinner />
                </main>
            }
        >
            <main
                className={cn(
                    "relative flex-1 p-4 overflow-y-auto [scrollbar-color:var(--scrollbar-thumb)_var(--scrollbar-track)] [scrollbar-gutter:stable_both-edges]",
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
            {/* Sized to its content so the glyph halo hugs the logo and title. */}
            <div className="glyph-halo mx-auto my-4 flex w-fit flex-col items-center gap-4">
                <AVUTLogo />
                <div className="font-semibold">{title}</div>
            </div>
            {children}
        </div>
    );
}

export const Std = {
    SidebarInset,
    ScrollContainer,
    Breadcrumbs,
    Navbar,
    IndexPage,
};
