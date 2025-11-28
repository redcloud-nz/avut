/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Hermes page design components.
 *
 * A section that contains a header and main content area, designed to be used within a Lexington column.
 */

import { ComponentProps } from "react";

import { AlertInfoIcon, ToParentPageIcon } from "@/components/icons";
import { S2_Button } from "@/components/ui/s2-button";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/items";
import { Link, LinkProps } from "@/components/ui/link";

import { cn } from "@/lib/utils";

function HermesSection({ className, ...props }: ComponentProps<"section">) {
    return (
        <section
            className={cn(
                "relative flex flex-col items-stretch gap-2 [&+section]:mt-6",
                className,
            )}
            data-component="HermesSection"
            {...props}
        />
    );
}

function HermesSectionHeader({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(" w-full flex gap-2 justify-between", className)}
            data-component="HermesSectionHeader"
            data-slot="section-header"
            {...props}
        />
    );
}

function HermesSectionTitle({ className, ...props }: ComponentProps<"h3">) {
    return (
        <h3
            className={cn(
                "scroll-m-20 text-2xl font-semibold tracking-tight",
                className,
            )}
            data-component="HermesSectionTitle"
            data-slot="section-title"
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
        <Item
            variant="outline"
            className={className}
            data-component="HermesEmpty"
            {...props}
        >
            <ItemMedia>
                <AlertInfoIcon />
            </ItemMedia>
            <ItemContent>
                <ItemTitle>{props.title}</ItemTitle>
                {props.description && (
                    <ItemDescription>{props.description}</ItemDescription>
                )}
            </ItemContent>
        </Item>
    );
}

function HermesBackButton({
    children,
    to,
    ...props
}: Omit<ComponentProps<typeof S2_Button>, "asChild"> & {
    to: LinkProps["to"];
}) {
    return (
        <S2_Button variant="outline" {...props} asChild>
            <Link to={to}>
                <ToParentPageIcon /> {children}
            </Link>
        </S2_Button>
    );
}

export const Hermes = {
    BackButton: HermesBackButton,
    Empty: HermesEmpty,
    Section: HermesSection,
    SectionHeader: HermesSectionHeader,
    SectionTitle: HermesSectionTitle,
};
