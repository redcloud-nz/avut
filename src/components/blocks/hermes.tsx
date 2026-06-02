/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Hermes page design components.
 *
 * A section that contains a header and main content area, designed to be used within a Lexington column.
 */

import { Route } from "next";
import NextLink from "next/link";
import { ComponentProps } from "react";

import { AlertInfoIcon, ToParentPageIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

import { cn } from "@/lib/utils";

function HermesSection({ className, ...props }: ComponentProps<"section">) {
    return (
        <section
            className={cn("relative flex flex-col items-stretch gap-2 [&+section]:mt-8", className)}
            data-component="HermesSection"
            {...props}
        />
    );
}

function HermesHeader({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn("w-full grid grid-cols-[36px_1fr_36px] gap-2", className)}
            data-component="HermesHeader"
            data-slot="header"
            {...props}
        />
    );
}

function HermesTitle({ className, ...props }: ComponentProps<"h3">) {
    return (
        <h3
            className={cn(
                "col-2",
                "scroll-m-20 text-lg font-semibold tracking-tight text-center overflow-hidden text-ellipsis whitespace-nowrap",
                className,
            )}
            data-component="HermesTitle"
            data-slot="title"
            {...props}
        />
    );
}
function HermesDescription({ className, ...props }: ComponentProps<"h3">) {
    return (
        <h3
            className={cn("col-2 mb-2", "text-xs text-center text-muted-foreground", className)}
            data-component="HermesDescription"
            data-slot="description"
            {...props}
        />
    );
}

function HermesEmpty({
    className,
    ...props
}: Omit<ComponentProps<typeof Item>, "children"> & {
    title: string;
    description?: string;
}) {
    return (
        <Item variant="outline" className={className} data-component="HermesEmpty" {...props}>
            <ItemMedia>
                <AlertInfoIcon />
            </ItemMedia>
            <ItemContent>
                <ItemTitle>{props.title}</ItemTitle>
                {props.description && <ItemDescription>{props.description}</ItemDescription>}
            </ItemContent>
        </Item>
    );
}

type HermesBackButtonProps = Omit<ComponentProps<typeof Button>, "asChild" | "children"> & {
    href: Route;
};

function HermesBackButton({ href, ...props }: HermesBackButtonProps) {
    return (
        <Button variant="ghost" {...props} asChild>
            <NextLink href={href}>
                <ToParentPageIcon className="size-5" />
            </NextLink>
        </Button>
    );
}

function HermesAction({ className, ...props }: ComponentProps<"div">) {
    return <div className={cn("col-3 flex items-center justify-end", className)} {...props} />;
}

function HermesSearch({ className, ...props }: ComponentProps<"div">) {
    return <div className={cn("col-2 flex items-center justify-center", className)} {...props} />;
}

export const Hermes = {
    BackButton: HermesBackButton,
    Empty: HermesEmpty,
    Section: HermesSection,
    Header: HermesHeader,
    Title: HermesTitle,
    Description: HermesDescription,
    Action: HermesAction,
    Search: HermesSearch,
};
