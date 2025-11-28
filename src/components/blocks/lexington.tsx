/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Lexington page design components.
 *
 * A page that contains a header and main content area, designed to be used within a sidebar layout.
 */

import { ComponentProps, ReactNode } from "react";

import { Slot } from "radix-ui";

import { S2_AppPageHeader } from "@/components/app-page";
import Artie from "@/components/art/artie";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";

import { cn } from "@/lib/utils";
import { tv, VariantProps } from "tailwind-variants";

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

function LexingtonColumnControls({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            className={cn(" w-full flex gap-2 justify-between", className)}
            data-component="LexingtonColumnControls"
            {...props}
        />
    );
}

export const Lexington = {
    Root: LexingtonRoot,
    Header: S2_AppPageHeader,
    Page: LexingtonPage,
    Empty: LexingtonEmpty,
    Column: LexingtonColumn,
    ColumnControls: LexingtonColumnControls,
};
