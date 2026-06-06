/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Saratoga layout components.
 *
 */

import { cn } from "@/lib/utils";
import { ComponentProps } from "react";

function SaratogaRoot({ children, className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-component="SaratogaRoot"
            className={cn("w-full max-w-5xl mx-auto space-y-2", className)}
            {...props}
        >
            {children}
        </div>
    );
}

function SaratogaHeader({ children, className, ...props }: ComponentProps<"header">) {
    return (
        <header
            data-component="SaratogaHeader"
            className={cn("flex gap-2 justify-between", className)}
            {...props}
        >
            {children}
        </header>
    );
}

function SaratogaTitle({ children, className, ...props }: ComponentProps<"h1">) {
    return (
        <h1
            data-component="SaratogaTitle"
            className={cn(
                "scroll-m-20 text-xl font-semibold tracking-tight overflow-hidden text-ellipsis whitespace-nowrap",
                className,
            )}
            {...props}
        >
            {children}
        </h1>
    );
}

function SaratogaActions({ children, className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-component="SaratogaActions"
            className={cn("flex items-center justify-end gap-2", className)}
            {...props}
        >
            {children}
        </div>
    );
}

function SaratogaColumns({ children, className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-component="SaratogaColumns"
            className={cn("grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4", className)}
            {...props}
        >
            {children}
        </div>
    );
}

function SaratogaMain({ children, className, ...props }: ComponentProps<"main">) {
    return (
        <main data-component="SaratogaMain" className={cn("space-y-4", className)} {...props}>
            {children}
        </main>
    );
}

function SaratogaSecondary({ children, className, ...props }: ComponentProps<"aside">) {
    return (
        <aside data-component="SaratogaSecondary" className={cn("space-y-4", className)} {...props}>
            {children}
        </aside>
    );
}

export const Saratoga = {
    Root: SaratogaRoot,
    Header: SaratogaHeader,
    Title: SaratogaTitle,
    Actions: SaratogaActions,
    Columns: SaratogaColumns,
    Main: SaratogaMain,
    Secondary: SaratogaSecondary,
};
