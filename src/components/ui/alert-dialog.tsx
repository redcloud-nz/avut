/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ComponentProps } from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AlertDialog({
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Root>) {
    return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

export function AlertDialogTrigger({
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
    return (
        <AlertDialogPrimitive.Trigger
            data-slot="alert-dialog-trigger"
            {...props}
        />
    );
}

export function AlertDialogPortal({
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Portal>) {
    return (
        <AlertDialogPrimitive.Portal
            data-slot="alert-dialog-portal"
            {...props}
        />
    );
}

export function AlertDialogOverlay({
    className,
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
    return (
        <AlertDialogPrimitive.Overlay
            data-slot="alert-dialog-overlay"
            className={cn(
                "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs",
                className,
            )}
            {...props}
        />
    );
}

export function AlertDialogContent({
    className,
    size = "default",
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content> & {
    size?: "default" | "sm";
}) {
    return (
        <AlertDialogPortal>
            <AlertDialogOverlay />
            <AlertDialogPrimitive.Content
                data-slot="alert-dialog-content"
                data-size={size}
                className={cn(
                    "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 bg-background ring-foreground/10 group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-none p-4 ring-1 duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm",
                    className,
                )}
                {...props}
            />
        </AlertDialogPortal>
    );
}

export function AlertDialogHeader({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-dialog-header"
            className={cn(
                "grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
                className,
            )}
            {...props}
        />
    );
}

export function AlertDialogFooter({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-dialog-footer"
            className={cn(
                "flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
                className,
            )}
            {...props}
        />
    );
}

export function AlertDialogMedia({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-dialog-media"
            className={cn(
                "bg-muted mb-2 inline-flex size-10 items-center justify-center rounded-none sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6",
                className,
            )}
            {...props}
        />
    );
}

export function AlertDialogTitle({
    className,
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
    return (
        <AlertDialogPrimitive.Title
            data-slot="alert-dialog-title"
            className={cn(
                "text-sm font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
                className,
            )}
            {...props}
        />
    );
}

export function AlertDialogDescription({
    className,
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
    return (
        <AlertDialogPrimitive.Description
            data-slot="alert-dialog-description"
            className={cn(
                "text-muted-foreground *:[a]:hover:text-foreground text-xs/relaxed text-balance md:text-pretty *:[a]:underline *:[a]:underline-offset-3",
                className,
            )}
            {...props}
        />
    );
}

export function AlertDialogAction({
    className,
    variant = "default",
    size = "default",
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action> &
    Pick<ComponentProps<typeof Button>, "variant" | "size">) {
    return (
        <Button variant={variant} size={size} asChild>
            <AlertDialogPrimitive.Action
                data-slot="alert-dialog-action"
                className={cn(className)}
                {...props}
            />
        </Button>
    );
}

export function AlertDialogCancel({
    className,
    variant = "outline",
    size = "default",
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel> &
    Pick<ComponentProps<typeof Button>, "variant" | "size">) {
    return (
        <Button variant={variant} size={size} asChild>
            <AlertDialogPrimitive.Cancel
                data-slot="alert-dialog-cancel"
                className={cn(className)}
                {...props}
            />
        </Button>
    );
}
