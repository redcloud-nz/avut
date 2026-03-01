/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";

import { Avatar as AvatarPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export function Avatar({
    className,
    size = "default",
    ...props
}: ComponentProps<typeof AvatarPrimitive.Root> & {
    size?: "default" | "sm" | "lg";
}) {
    return (
        <AvatarPrimitive.Root
            data-slot="avatar"
            data-size={size}
            className={cn(
                "after:border-border group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
                className,
            )}
            {...props}
        />
    );
}

export function AvatarImage({
    className,
    ...props
}: ComponentProps<typeof AvatarPrimitive.Image>) {
    return (
        <AvatarPrimitive.Image
            data-slot="avatar-image"
            className={cn(
                "aspect-square size-full rounded-full object-cover",
                className,
            )}
            {...props}
        />
    );
}

export function AvatarFallback({
    className,
    ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>) {
    return (
        <AvatarPrimitive.Fallback
            data-slot="avatar-fallback"
            className={cn(
                "bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full text-sm group-data-[size=sm]/avatar:text-xs",
                className,
            )}
            {...props}
        />
    );
}

export function AvatarBadge({ className, ...props }: ComponentProps<"span">) {
    return (
        <span
            data-slot="avatar-badge"
            className={cn(
                "bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 select-none",
                "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
                "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
                "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
                className,
            )}
            {...props}
        />
    );
}

export function AvatarGroup({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="avatar-group"
            className={cn(
                "*:data-[slot=avatar]:ring-background group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2",
                className,
            )}
            {...props}
        />
    );
}

export function AvatarGroupCount({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="avatar-group-count"
            className={cn(
                "bg-muted text-muted-foreground ring-background relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs ring-2 group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
                className,
            )}
            {...props}
        />
    );
}
