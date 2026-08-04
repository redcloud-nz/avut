/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Std page shell components.
 *
 * The outer shell for a page within a sidebar layout: a sticky navbar with
 * breadcrumbs above a scrollable main content area.
 */

import type { Route } from "next";
import Link from "next/link";
import { ComponentProps, Fragment, ReactNode, Suspense } from "react";

import { AVUTLogo } from "@/components/art/avut-logo";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { RainbowSpinner } from "@/components/ui/loading";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function SidebarInset({ children }: { children: ReactNode }) {
    return (
        <div
            data-component="StdSidebarInset"
            className="relative flex w-full h-svh flex-1 flex-col bg-background"
        >
            {children}
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

    return (
        <Breadcrumb className="px-2">
            <BreadcrumbList>
                {normalizedBreadcrumbs.slice(0, -1).map((breadcrumb, idx) => (
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
                <BreadcrumbItem>
                    <BreadcrumbPage>
                        {normalizedBreadcrumbs[normalizedBreadcrumbs.length - 1].label}
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );
}

type NavbarProps = {
    sidebarTrigger?: boolean;
} & (
    | {
          breadcrumbs?: (BreadcrumbItem | string)[];
          children?: never;
      }
    | { children?: ReactNode; breadcrumbs?: never }
);

function Navbar({ breadcrumbs, children, sidebarTrigger = true }: NavbarProps) {
    return (
        <header
            slot="header"
            className="bg-background sticky top-0 flex h-(--header-height) shrink-0 items-center gap-1 border-b px-2 z-5 backdrop-blur-md"
        >
            {sidebarTrigger && (
                <>
                    <SidebarTrigger />
                    <Separator orientation="vertical" className="ml-1" />
                </>
            )}
            {breadcrumbs && <Breadcrumbs breadcrumbs={breadcrumbs} />}
            {children}
        </header>
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
        <div className={cn("w-full sm:w-lg sm:mx-auto", className)} {...props}>
            <div className="flex flex-col items-center my-4 gap-4">
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
