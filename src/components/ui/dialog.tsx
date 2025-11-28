/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { LoaderCircleIcon, XIcon } from "lucide-react";
import {
    type ComponentProps,
    ComponentPropsWithoutRef,
    type ReactNode,
    Suspense,
} from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import { Alert } from "./alert";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export const Dialog = DialogPrimitive.Root;

export const DialogTrigger = DialogPrimitive.Trigger;

export const DialogPortal = DialogPrimitive.Portal;

export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({
    className,
    ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
        <DialogPrimitive.Overlay
            className={cn(
                "fixed inset-0 z-50 bg-black/80",
                " data-[state=open]:animate-in data-[state=open]:fade-in-0",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                className,
            )}
            {...props}
        />
    );
}

type DialogContentProps = ComponentPropsWithoutRef<
    typeof DialogPrimitive.Content
> & {
    blockInteractOutside?: boolean;
};

export function DialogContent({
    blockInteractOutside,
    children,
    className,
    ...props
}: DialogContentProps) {
    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
                className={cn(
                    "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg duration-200",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0  data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] ",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
                    className,
                )}
                onInteractOutside={(event) => {
                    if (blockInteractOutside) event.preventDefault();
                    props.onInteractOutside?.(event);
                }}
                {...props}
            >
                {children}
                <DialogPrimitive.Close
                    className={cn(
                        "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity",
                        "hover:opacity-100",
                        "focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2",
                        "disabled:pointer-events-none",
                        "data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
                    )}
                >
                    <XIcon className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPortal>
    );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "flex flex-col space-y-1.5 text-center sm:text-left",
                className,
            )}
            {...props}
        />
    );
}

/**
 * DialogBody is a wrapper around the body contents of a dialog that provides error handling and loading state.
 */
export function DialogBody({ children }: { children: ReactNode }) {
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

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
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

export function DialogTitle({
    className,
    ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            className={cn(
                "text-lg font-semibold leading-none tracking-tight",
                className,
            )}
            {...props}
        />
    );
}

export function DialogDescription({
    className,
    ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

/**
 * A {@link Button} that triggers a dialog when clicked. It also displays a tooltip with the provided text.
 * @param tooltip The text to display in the tooltip.
 */
export function DialogTriggerButton({
    variant = "ghost",
    size = "icon",
    tooltip,
    ...props
}: ComponentProps<typeof Button> & { tooltip?: ReactNode }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <DialogTrigger asChild>
                    <Button variant={variant} size={size} {...props} />
                </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}
