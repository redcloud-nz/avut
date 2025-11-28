/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { LoaderCircleIcon, X } from "lucide-react";
import {
    ComponentProps,
    ComponentPropsWithRef,
    ReactNode,
    Suspense,
} from "react";
import { ErrorBoundary } from "react-error-boundary";
import { tv, type VariantProps } from "tailwind-variants";

import { Dialog as SheetPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import { Alert } from "./alert";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export const Sheet = SheetPrimitive.Root;

export const SheetTrigger = SheetPrimitive.Trigger;

export const SheetClose = SheetPrimitive.Close;

export const SheetPortal = SheetPrimitive.Portal;

export function SheetOverlay({
    className,
    ...props
}: ComponentPropsWithRef<typeof SheetPrimitive.Overlay>) {
    return (
        <SheetPrimitive.Overlay
            className={cn(
                "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                className,
            )}
            {...props}
        />
    );
}

const sheetContentVariants = tv({
    base: "fixed z-50 space-y-4 bg-background px-4 pt-3 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-300",
    variants: {
        side: {
            top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
            bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
            right: "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
        },
    },
    defaultVariants: {
        side: "right",
    },
});

export interface SheetContentProps
    extends
        ComponentPropsWithRef<typeof SheetPrimitive.Content>,
        VariantProps<typeof sheetContentVariants> {}

export function SheetContent({
    side = "right",
    className,
    children,
    ...props
}: SheetContentProps) {
    return (
        <SheetPortal>
            <SheetOverlay />
            <SheetPrimitive.Content
                className={sheetContentVariants({ side, className })}
                {...props}
            >
                {children}
                <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </SheetPrimitive.Close>
            </SheetPrimitive.Content>
        </SheetPortal>
    );
}

export function SheetHeader({
    className,
    ...props
}: React.ComponentPropsWithRef<"div">) {
    return (
        <div
            className={cn(
                "flex flex-col space-y-2 text-center sm:text-left",
                className,
            )}
            {...props}
        />
    );
}

/**
 * DialogBody is a wrapper around the body contents of a dialog that provides error handling and loading state.
 */
export function SheetBody({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary
            fallbackRender={({ error }) => (
                <>
                    <Alert severity="error" title="An error occurred">
                        {error.message}
                    </Alert>
                </>
            )}
        >
            <Suspense
                fallback={
                    <div className="h-full w-full flex items-center justify-center">
                        <LoaderCircleIcon className="w-10 h-10 animate-spin" />
                    </div>
                }
            >
                {children}
            </Suspense>
        </ErrorBoundary>
    );
}

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
                className,
            )}
            {...props}
        />
    );
}

export function SheetTitle({
    className,
    ...props
}: ComponentProps<typeof SheetPrimitive.Title>) {
    return (
        <SheetPrimitive.Title
            className={cn("text-lg font-semibold text-foreground", className)}
            {...props}
        />
    );
}

export function SheetDescription({
    className,
    ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>) {
    return (
        <SheetPrimitive.Description
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

/**
 * A {@link Button} that triggers a sheet when clicked. It also displays a tooltip with the provided text.
 * @param tooltip The text to display in the tooltip.
 */
export function SheetTriggerButton({
    variant = "ghost",
    size = "icon",
    tooltip,
    ...props
}: ComponentProps<typeof Button> & { tooltip?: ReactNode }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <SheetTrigger asChild>
                    <Button variant={variant} size={size} {...props} />
                </SheetTrigger>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}
