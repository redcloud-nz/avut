/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { InfoIcon } from "lucide-react";
import Link from "next/link";
import { ComponentProps, Fragment, ReactNode } from "react";
import { omit } from "remeda";
import { tv, type VariantProps } from "tailwind-variants";

import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heading } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

export const appPageContentVariants = tv({
    base: "col-span-full",
    variants: {
        variant: {
            default: "flex flex-1 flex-col gap-4 p-4",
            full: "w-full flex flex-col items-stretch",
            centered: "w-full flex flex-col items-center justify-center",
            container:
                "flex flex-col items-center gap-4 p-4 *:w-full xl:*:w-4xl overflow-y-auto relative",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

export type PageBreadcrumb = { label: string; href?: string };

function normalizeBreadcrumbs(
    breadcrumbs: (PageBreadcrumb | string)[],
): PageBreadcrumb[] {
    return breadcrumbs.map((breadcrumb) =>
        typeof breadcrumb === "string" ? { label: breadcrumb } : breadcrumb,
    );
}

export interface AppPageBreadcrumbsProps {
    breadcrumbs?: (PageBreadcrumb | string)[];
}

function AppPageBreadcrumbs_Inner({
    breadcrumbs = [],
}: AppPageBreadcrumbsProps) {
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

interface AppPageHeaderProps {
    breadcrumbs?: (PageBreadcrumb | string)[];
    sidebarTrigger?: boolean;
}

/**
 * Page header for design System 2. To be used inside `SidebarInset` component.
 */
export function S2_AppPageHeader({
    breadcrumbs,
    sidebarTrigger = true,
}: AppPageHeaderProps) {
    return (
        <header className="bg-background sticky top-0 flex h-(--header-height) shrink-0 items-center gap-1 border-b px-2 z-5 backdrop-blur-md">
            {sidebarTrigger && (
                <>
                    <SidebarTrigger />
                    <Separator orientation="vertical" className="ml-1" />
                </>
            )}
            {breadcrumbs && (
                <AppPageBreadcrumbs_Inner breadcrumbs={breadcrumbs} />
            )}
        </header>
    );
}
