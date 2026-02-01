/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Lexington page design components.
 *
 * A page that contains a header and main content area, designed to be used within a sidebar layout.
 */

import Link from "next/link";
import { Slot } from "radix-ui";
import { ComponentProps, Fragment, ReactNode } from "react";
import { tv, VariantProps } from "tailwind-variants";

import Artie from "@/components/art/artie";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

function LexingtonRoot({ children }: { children: ReactNode }) {
    return (
        <div
            data-component="LexingtonRoot"
            className="relative flex h-svh flex-1 flex-col bg-background"
        >
            {children}
        </div>
    );
}

const lexingtonPageVariants = tv({
    base: "flex flex-row justify-center h-[calc(100vh-var(--header-height))] [scrollbar-color:var(--scrollbar-thumb)_var(--scrollbar-track)] [scrollbar-gutter:stable_both-edges]",
    variants: {
        scrollable: {
            true: "overflow-y-auto",
        },
    },
});

type BreadcrumbItem = { label: string; href?: string };

function normalizeBreadcrumbs(
    breadcrumbs: (BreadcrumbItem | string)[],
): BreadcrumbItem[] {
    return breadcrumbs.map((breadcrumb) =>
        typeof breadcrumb === "string" ? { label: breadcrumb } : breadcrumb,
    );
}

interface LexingtonBreadcrumbsProps {
    breadcrumbs?: (BreadcrumbItem | string)[];
}

function LexingtonBreadcrumbs({ breadcrumbs = [] }: LexingtonBreadcrumbsProps) {
    const normalizedBreadcrumbs = normalizeBreadcrumbs(breadcrumbs);

    return (
        <Breadcrumb className="px-2">
            <BreadcrumbList>
                {normalizedBreadcrumbs.slice(0, -1).map((breadcrumb, idx) => (
                    <Fragment key={idx}>
                        <BreadcrumbItem className="hidden md:block">
                            {breadcrumb.href ? (
                                <BreadcrumbLink asChild>
                                    <Link href={breadcrumb.href}>
                                        {breadcrumb.label}
                                    </Link>
                                </BreadcrumbLink>
                            ) : (
                                <span className="text-muted-foreground">
                                    {breadcrumb.label}
                                </span>
                            )}
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="hidden md:block" />
                    </Fragment>
                ))}
                <BreadcrumbItem>
                    <BreadcrumbPage>
                        {
                            normalizedBreadcrumbs[
                                normalizedBreadcrumbs.length - 1
                            ].label
                        }
                    </BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );
}

interface LexingtonHeaderProps {
    breadcrumbs?: (BreadcrumbItem | string)[];
    sidebarTrigger?: boolean;
}

export function LexingtonHeader({
    breadcrumbs,
    sidebarTrigger = true,
}: LexingtonHeaderProps) {
    return (
        <header className="bg-background sticky top-0 flex h-(--header-height) shrink-0 items-center gap-1 border-b px-2 z-5 backdrop-blur-md">
            {sidebarTrigger && (
                <>
                    <SidebarTrigger />
                    <Separator orientation="vertical" className="ml-1" />
                </>
            )}
            {breadcrumbs && <LexingtonBreadcrumbs breadcrumbs={breadcrumbs} />}
        </header>
    );
}

function LexingtonPage({
    asChild = false,
    children,
    className,
    scrollable = true,
    ...props
}: ComponentProps<"main"> &
    VariantProps<typeof lexingtonPageVariants> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : "main";

    return (
        <Comp
            className={lexingtonPageVariants({ className, scrollable })}
            data-component="LexingtonPage"
            data-slot="page"
            {...props}
        >
            {children}
        </Comp>
    );
}

interface LexingtonPageEmptyProps {
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
}

function LexingtonEmpty({
    title,
    description,
    children,
}: LexingtonPageEmptyProps) {
    return (
        <Empty data-component="LexingtonPageEmpty">
            <EmptyHeader>
                <EmptyMedia>
                    <Artie pose="Empty" />
                </EmptyMedia>
                <EmptyTitle>{title}</EmptyTitle>
                <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>{children}</EmptyContent>
        </Empty>
    );
}

const lexingtonColumnVariants = tv({
    base: "h-fit p-4 space-y-2 peer",
    variants: {
        width: {
            xs: "w-full xs:w-md xs:mx-auto",
            sm: "w-full sm:w-lg sm:mx-auto",
            md: "w-full md:w-xl md:mx-auto",
            lg: "w-full lg:w-2xl lg:mx-auto",
            xl: "w-full xl:w-3xl xl:mx-auto",
            full: "w-full",
        },
    },
    defaultVariants: {
        width: "full",
    },
});

function LexingtonColumn({
    asChild = false,
    className,
    width = "full",
    ...props
}: ComponentProps<"div"> &
    VariantProps<typeof lexingtonColumnVariants> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : "div";

    return (
        <Comp
            className={lexingtonColumnVariants({ className, width })}
            data-component="LexingtonColumn"
            data-slot="column"
            {...props}
        />
    );
}

export const Lexington = {
    Root: LexingtonRoot,
    Header: LexingtonHeader,
    Page: LexingtonPage,
    Empty: LexingtonEmpty,
    Column: LexingtonColumn,
};
