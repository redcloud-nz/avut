/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function LoadingSpinner({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "animate-spin rounded-full border-t-1 border-b-1 border-gray-900 aspect-square",
                className,
            )}
            data-slot="spinner"
            {...props}
        />
    );
}

export function LoadingOverlay({
    className,
    ...props
}: Omit<ComponentProps<"div">, "children">) {
    return (
        <div
            className={cn(
                "fixed inset-0 z-50 bg-black/80",
                "data-[state=open]:animate-in data-[state=open]:fade-in-0",
                "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                className,
            )}
            {...props}
        >
            <div className="flex items-center justify-center h-full">
                <LoadingSpinner className="h-32 w-32 border-gray-200" />
            </div>
        </div>
    );
}

export function LoadingFallback({
    className,
    ...props
}: Omit<ComponentProps<"div">, "children">) {
    return (
        <div
            className={cn(
                "w-full h-16 flex items-center justify-center rounded-md bg-muted animate-pulse",
                className,
            )}
            {...props}
        >
            <LoadingSpinner className="min-w-12 min-h-12" />
        </div>
    );
}

export function PageLoadingSpinner({
    className,
    message,
    ...props
}: ComponentProps<"div"> & { message?: string }) {
    return (
        <div
            className={cn(
                "w-full h-[calc(100vh-var(--header-height))] flex items-center justify-center",
                className,
            )}
            {...props}
        >
            <RainbowSpinner className="size-48 sm:size-80" message={message} />
        </div>
    );
}

export function RainbowSpinner({
    className,
    message,
    ...props
}: Omit<ComponentProps<"div">, "children"> & { message?: string }) {
    return (
        <div className={cn("relative size-48", className)} {...props}>
            <div className="absolute w-full aspect-square transform translate-x-[-50%] translate-y-[-50%] left-1/2 top-1/2 rounded-full animate-[spin_2s_linear_infinite] border-t-4 border-l-2 border-red-500" />
            <div className="absolute w-[95%] aspect-square transform translate-x-[-50%] translate-y-[-50%] left-1/2 top-1/2 rounded-full animate-[spin_4s_linear_infinite] border-t-4 border-l-2 border-green-500" />
            <div className="absolute w-[90%] aspect-square transform translate-x-[-50%] translate-y-[-50%] left-1/2 top-1/2 rounded-full animate-[spin_8s_linear_infinite] border-t-4 border-l-2 border-blue-500" />
            <div className="absolute w-[80%] transform translate-x-[-50%] translate-y-[-50%] left-1/2 top-1/2 text-lg text-center font-medium tracking-tight animate-pulse">
                {message}
            </div>
        </div>
    );
}
