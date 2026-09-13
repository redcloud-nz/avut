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
import { ChevronDownIcon, MinusIcon } from "lucide-react";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageLoadingSpinner, RainbowSpinner } from "@/components/ui/loading";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function SidebarInset({ children }: { children: ReactNode }) {
    return (
        <div
            data-component="StdSidebarInset"
            className="relative flex w-full min-w-0 h-svh flex-1 flex-col bg-background"
        >
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

    return (
        <Breadcrumb className="px-2">
            <BreadcrumbList className="flex-nowrap">
                {/* Mobile: the whole trail collapses to the current page label + a
                    dropdown of every ancestor crumb, so there's still a way back up. */}
                {ancestors.length > 0 && (
                    <BreadcrumbItem className="md:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-1 font-normal text-foreground">
                                {current.label}
                                <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-64">
                                <DropdownMenuLabel>Location</DropdownMenuLabel>
                                {[...ancestors, current].map((crumb, idx) => {
                                    const content = (
                                        <span
                                            className="flex items-center gap-1 whitespace-nowrap"
                                            style={{ paddingLeft: Math.max(0, idx - 1) * 12 }}
                                        >
                                            {idx > 0 && (
                                                <MinusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                            )}
                                            {crumb.label}
                                        </span>
                                    );
                                    return crumb === current ? (
                                        <DropdownMenuItem
                                            key={idx}
                                            disabled
                                            className="font-normal text-foreground opacity-100"
                                        >
                                            {content}
                                        </DropdownMenuItem>
                                    ) : crumb.href ? (
                                        <DropdownMenuItem key={idx} asChild>
                                            <Link href={crumb.href}>{content}</Link>
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem
                                            key={idx}
                                            disabled
                                            className="text-muted-foreground opacity-100"
                                        >
                                            {content}
                                        </DropdownMenuItem>
                                    );
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
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
                <BreadcrumbItem className={ancestors.length > 0 ? "hidden md:block" : undefined}>
                    <BreadcrumbPage>{current.label}</BreadcrumbPage>
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
          /** Right-aligned controls (e.g. `<HelpButton>`), pinned to the far edge of the navbar. */
          actions?: ReactNode;
          children?: never;
      }
    | { children?: ReactNode; breadcrumbs?: never; actions?: never }
);

function Navbar({ breadcrumbs, actions, children, sidebarTrigger = true }: NavbarProps) {
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
            {actions && <div className="ml-auto flex items-center gap-1 pr-1">{actions}</div>}
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
