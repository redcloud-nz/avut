/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { Slot as SlotPrimitive } from "radix-ui";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function ItemGroup({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            role="list"
            data-slot="item-group"
            className={cn(
                "group/item-group flex w-full flex-col gap-4 has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2",
                className,
            )}
            {...props}
        />
    );
}

export function ItemSeparator({
    className,
    ...props
}: ComponentProps<typeof Separator>) {
    return (
        <Separator
            data-slot="item-separator"
            orientation="horizontal"
            className={cn("my-0", className)}
            {...props}
        />
    );
}

export const itemVariants = tv({
    base: "[a]:hover:bg-muted rounded-none border text-xs w-full group/item focus-visible:border-ring focus-visible:ring-ring/50 flex items-center flex-wrap outline-none transition-colors duration-100 focus-visible:ring-[3px] [a]:transition-colors",
    variants: {
        variant: {
            default: "border-transparent",
            outline: "border-border",
            muted: "bg-muted/50 border-transparent",
        },
        size: {
            default: "gap-2.5 px-3 py-2.5",
            sm: "gap-2.5 px-3 py-2.5",
            xs: "gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
});

export function Item({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    ...props
}: ComponentProps<"div"> &
    VariantProps<typeof itemVariants> & { asChild?: boolean }) {
    const Comp = asChild ? SlotPrimitive.Slot : "div";
    return (
        <Comp
            data-slot="item"
            data-variant={variant}
            data-size={size}
            className={cn(itemVariants({ variant, size, className }))}
            {...props}
        />
    );
}

const itemMediaVariants = tv({
    base: "gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start flex shrink-0 items-center justify-center [&_svg]:pointer-events-none",
    variants: {
        variant: {
            default: "bg-transparent",
            icon: "[&_svg:not([class*='size-'])]:size-4",
            image: "size-10 overflow-hidden rounded-none group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

export function ItemMedia({
    className,
    variant = "default",
    ...props
}: ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
    return (
        <div
            data-slot="item-media"
            data-variant={variant}
            className={cn(itemMediaVariants({ variant, className }))}
            {...props}
        />
    );
}

export function ItemContent({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="item-content"
            className={cn(
                "flex flex-1 flex-col gap-1 group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none",
                className,
            )}
            {...props}
        />
    );
}

export function ItemTitle({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="item-title"
            className={cn(
                "line-clamp-1 flex w-fit items-center gap-2 text-xs font-medium underline-offset-4",
                className,
            )}
            {...props}
        />
    );
}

export function ItemDescription({ className, ...props }: ComponentProps<"p">) {
    return (
        <p
            data-slot="item-description"
            className={cn(
                "text-muted-foreground [&>a:hover]:text-primary line-clamp-2 text-left text-xs/relaxed font-normal group-data-[size=xs]/item:text-xs/relaxed [&>a]:underline [&>a]:underline-offset-4",
                className,
            )}
            {...props}
        />
    );
}

export function ItemActions({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="item-actions"
            className={cn("flex items-center gap-2", className)}
            {...props}
        />
    );
}

export function ItemHeader({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="item-header"
            className={cn(
                "flex basis-full items-center justify-between gap-2",
                className,
            )}
            {...props}
        />
    );
}

export function ItemFooter({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="item-footer"
            className={cn(
                "flex basis-full items-center justify-between gap-2",
                className,
            )}
            {...props}
        />
    );
}
