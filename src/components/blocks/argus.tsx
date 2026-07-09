/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Argus blocks for building card forms that are centered on the page.
 */

import Image from "next/image";
import { ComponentProps, ReactNode } from "react";

import { AVUTLogo } from "@/components/art/avut-logo";
import { cn } from "@/lib/utils";

function ArgusRoot({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "bg-muted flex min-h-svh flex-1 flex-col items-center justify-center gap-6 p-6 md:p-10",
                className,
            )}
            {...props}
        />
    );
}

function ArgusColumn({
    className,
    width = "sm",
    ...props
}: ComponentProps<"div"> & { width?: "sm" | "md" | "lg" }) {
    return (
        <div
            slot="column"
            className={cn(
                `flex w-full flex-col gap-6`,
                width == "sm" && "max-w-sm",
                width == "md" && "max-w-md",
                width == "lg" && "max-w-lg",
                className,
            )}
            {...props}
        />
    );
}

function ArgusAppLogo() {
    return (
        <div className="w-[150px] self-center">
            <Image
                src="/avut-logo.svg"
                alt="A.V.U.T. Logo"
                width={150}
                height={50}
                className="dark:invert"
            />
        </div>
    );
}

function ArgusHeader({
    className,
    title,
    ...props
}: Omit<ComponentProps<"div">, "children"> & { title: string }) {
    return (
        <div className={cn("flex flex-col items-center gap-4", className)} {...props}>
            <AVUTLogo />
            <div className="font-semibold">{title}</div>
        </div>
    );
}

function ArgusFooter({ className, ...props }: ComponentProps<"p">) {
    return (
        <p
            data-slot="argus-footer"
            className={cn(
                "text-muted-foreground text-sm leading-normal font-normal px-6 text-center",
                "last:mt-0 nth-last-2:-mt-1",
                "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
                className,
            )}
            {...props}
        />
    );
}

export const Argus = {
    Root: ArgusRoot,
    Column: ArgusColumn,
    AppLogo: ArgusAppLogo,
    Header: ArgusHeader,
    Footer: ArgusFooter,
};
