/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { EllipsisVerticalIcon, InfoIcon } from "lucide-react";
import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./dropdown-menu";
import { LoadingSpinner } from "./loading";
import { Popover, PopoverContent, PopoverTriggerButton } from "./popover";

export function Card({
    className,
    raised,
    ...props
}: ComponentProps<"div"> & { raised?: boolean }) {
    return (
        <div
            className={cn(
                "rounded-sm border bg-card text-card-foreground transition-shadow mb-2",
                raised ? "shadow-md" : "shadow-sm",
                className,
            )}
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn("h-10 flex items-center border-b gap-2", className)}
            {...props}
        />
    );
}

export function CardTitle({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "text-2xl font-semibold leading-10 grow px-3",
                className,
            )}
            data-slot="title"
            {...props}
        />
    );
}

export function CardActions({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn("h-10 flex items-center lg:gap-1 lg:px-1", className)}
            {...props}
        />
    );
}

export function CardDescription({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}

export function CardContent({
    children,
    className,
    loading,
    ...props
}: ComponentProps<"div"> & { loading?: boolean }) {
    return (
        <div className={cn("p-1", className)} {...props}>
            {loading ? (
                <div className="flex justify-center items-center py-2">
                    <LoadingSpinner className="w-12 h-12" />
                </div>
            ) : (
                children
            )}
        </div>
    );
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "h-10 p-1 flex items-center gap-2 border-t",
                className,
            )}
            {...props}
        />
    );
}

export function CardGrid({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4", className)}
            {...props}
        />
    );
}

export function CardExplanation({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <Popover>
            <PopoverTriggerButton
                variant="ghost"
                size="icon"
                tooltip="Card Description"
            >
                <InfoIcon />
            </PopoverTriggerButton>
            <PopoverContent align="end" className="w-96">
                <div
                    className={cn(
                        "text-sm text-muted-foreground space-y-2",
                        className,
                    )}
                    {...props}
                />
            </PopoverContent>
        </Popover>
    );
}

export function CardMenu({
    children,
    title,
    ...props
}: ComponentProps<typeof DropdownMenu> & { title: string }) {
    return (
        <DropdownMenu {...props}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <EllipsisVerticalIcon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-center">
                    {title}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
