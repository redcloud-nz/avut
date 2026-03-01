/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";

import { Slot as SlotPrimitive } from "radix-ui";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const buttonGroupVariants = tv({
    base: "rounded-none has-[>[data-slot=button-group]]:gap-2 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-none flex w-fit items-stretch *:focus-visible:z-10 *:focus-visible:relative [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
    variants: {
        orientation: {
            horizontal:
                "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
            vertical:
                "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
        },
    },
    defaultVariants: {
        orientation: "horizontal",
    },
});

export function ButtonGroup({
    className,
    orientation,
    ...props
}: ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
    return (
        <div
            role="group"
            data-slot="button-group"
            data-orientation={orientation}
            className={cn(buttonGroupVariants({ orientation }), className)}
            {...props}
        />
    );
}

export function ButtonGroupText({
    className,
    asChild = false,
    ...props
}: ComponentProps<"div"> & { asChild?: boolean }) {
    const Comp = asChild ? SlotPrimitive.Slot : "div";

    return (
        <Comp
            className={cn(
                "bg-muted flex items-center gap-2 rounded-none border px-2.5 text-xs font-medium [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        />
    );
}

export function ButtonGroupSeparator({
    className,
    orientation = "vertical",
    ...props
}: ComponentProps<typeof Separator>) {
    return (
        <Separator
            data-slot="button-group-separator"
            orientation={orientation}
            className={cn(
                "bg-input relative self-stretch data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto",
                className,
            )}
            {...props}
        />
    );
}
