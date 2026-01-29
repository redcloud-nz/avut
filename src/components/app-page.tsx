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

interface AppPageProps {
    children?: ReactNode;
    showLeftSidebarTrigger?: boolean;
    showRightSidebarTrigger?: boolean;
    rightControls?: ReactNode;
}

export function AppPage({
    children,
    rightControls,
    showLeftSidebarTrigger = true,
    showRightSidebarTrigger = false,
}: AppPageProps) {
    return (
        <div className="h-screen flex-1 grid grid-rows-[48px_1px_1fr] grid-cols-[auto_1fr_auto] overflow-hidden">
            {showLeftSidebarTrigger && (
                <div className="row-1 col-1 flex justify-center items-center pl-2 gap-2">
                    <SidebarTrigger />
                    <Separator orientation="vertical" />
                </div>
            )}

            <div className="row-1 col-3 flex justify-center items-center pr-1 gap-1">
                {rightControls ? rightControls : null}
                {showRightSidebarTrigger ? (
                    <>
                        <Separator orientation="vertical" />
                        {/* <S2_SidebarTrigger side="right"/> */}
                    </>
                ) : null}
            </div>
            <Separator
                className="row-start-2 col-span-full"
                orientation="horizontal"
            />
            {children}
        </div>
    );
}

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

export type AppPageContentProps = ComponentProps<
    typeof ScrollAreaPrimitive.Root
> &
    VariantProps<typeof appPageContentVariants>;

export function AppPageContent({
    children,
    className,
    variant = "default",
    ...props
}: AppPageContentProps) {
    return (
        <main
            className={cn(appPageContentVariants({ variant, className }))}
            {...props}
        >
            {children}
        </main>
    );
}

interface ScrollablePageContentProps {
    children: ReactNode;
    slotProps?: {
        scrollArea?: Omit<ComponentProps<typeof ScrollArea>, "children">;
        main?: Omit<ComponentProps<"main">, "children">;
    };
}

export function ScrollablePageContent({
    children,
    slotProps = {},
}: ScrollablePageContentProps) {
    const { scrollArea: scrollAreaProps, main: mainProps } = {
        scrollArea: {},
        main: {},
        ...slotProps,
    };

    return (
        <ScrollArea
            style={{ height: `calc(100vh - var(--header-height))` }}
            className={cn(
                "col-span-full [&>[data-slot=scroll-area-viewport]]:pb-8",
                scrollAreaProps.className,
            )}
            {...omit(scrollAreaProps, ["className"])}
        >
            <main
                className={cn(
                    "max-w-4xl mx-auto space-y-4 p-4",
                    mainProps.className,
                )}
                {...omit(mainProps, ["className"])}
            >
                {children}
            </main>
        </ScrollArea>
    );
}

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

export function AppPageBreadcrumbs({
    breadcrumbs = [],
}: AppPageBreadcrumbsProps) {
    if (breadcrumbs.length === 0) return null;

    return (
        <div className="row-1 col-2 flex items-center h-12 gap-2 pr-2">
            <AppPageBreadcrumbs_Inner breadcrumbs={breadcrumbs} />
        </div>
    );
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
        <header className="bg-background sticky top-0 flex h-[var(--header-height)] shrink-0 items-center gap-1 border-b px-2 z-5 backdrop-blur-md">
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

export function S2_AppPageMain({ children, ...props }: ComponentProps<"main">) {
    return (
        <main className="h-[calc(100vh - var(--header-height))] p-4" {...props}>
            {children}
        </main>
    );
}

export function AppPageControls({
    children,
    className,
}: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "row-start-1 col-start-3 flex items-center gap-1 pr-1",
                className,
            )}
        >
            {children}
        </div>
    );
}

export function PageHeader({ className, ...props }: ComponentProps<"header">) {
    return (
        <header
            className={cn(
                "grid",
                "md:grid-cols-2 md:grid-rows-[auto_auto] ",
                className,
            )}
            {...props}
        />
    );
}

export type PageTitleProps = ComponentProps<"h1"> & {
    objectType?: string;
};

export function PageTitle({
    children,
    className,
    objectType,
    ...props
}: PageTitleProps) {
    return (
        <Heading
            level={1}
            className={cn("row-start-1", className)}
            data-slot="title"
            {...props}
        >
            {objectType ? (
                <div className="text-sm font-normal tracking-normal text-muted-foreground">
                    {objectType}
                </div>
            ) : null}
            {children}
        </Heading>
    );
}

export function PageDescription({ className, ...props }: ComponentProps<"p">) {
    return (
        <p
            className={cn(
                "mt-2 text-sm text-gray-700 hidden md:block",
                "row-start-2",
                className,
            )}
            data-slot="description"
            {...props}
        />
    );
}

export function PageControls({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "row-start-1 row-span-2 col-start-2 justify-self-end self-end",
                "flex gap-2",
                className,
            )}
            {...props}
        />
    );
}

export function PageExplanation({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <Popover>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <InfoIcon />
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Page Explanation</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-96">
                <div
                    className={cn(
                        "text-sm text-muted-foreground space-y-2",
                        className,
                    )}
                    {...props}
                />
            </PopoverContent>
        </Popover>
    );
}
