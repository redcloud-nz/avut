/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as React from "react";

import { Avatar as AvatarPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export function Avatar({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof AvatarPrimitive.Root>) {
    return (
        <AvatarPrimitive.Root
            className={cn(
                "relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full",
                className,
            )}
            {...props}
        />
    );
}

export function AvatarImage({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof AvatarPrimitive.Image>) {
    return (
        <AvatarPrimitive.Image
            className={cn("aspect-square h-full w-full", className)}
            {...props}
        />
    );
}

export function AvatarFallback({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof AvatarPrimitive.AvatarFallback>) {
    return (
        <AvatarPrimitive.Fallback
            className={cn(
                "flex h-full w-full items-center justify-center rounded-full bg-muted",
                className,
            )}
            {...props}
        />
    );
}
