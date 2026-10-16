/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { type LucideIcon } from "lucide-react";
import { Route } from "next";
import Link from "next/link";
import * as React from "react";

import { Item, ItemDescription, ItemHeader, ItemMedia, ItemTitle } from "@/components/ui/item";
import { cn } from "@/lib/utils";

export function StatCardGrid({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)} {...props} />;
}

/**
 * A headline number. With `href` it's a control — raised, and links to the detail behind the
 * number; without, it's a flat card.
 */
export function StatCard({
    icon: Icon,
    value,
    label,
    href,
    className,
}: {
    icon: LucideIcon;
    value: number | string;
    label: string;
    href?: Route;
    className?: string;
}) {
    const body = (
        <>
            <ItemHeader className="justify-between">
                <ItemMedia>
                    <Icon className="size-9 text-muted-foreground" />
                </ItemMedia>
                <ItemTitle className="min-w-14 text-3xl font-semibold">{value}</ItemTitle>
            </ItemHeader>
            <ItemDescription>{label}</ItemDescription>
        </>
    );

    return href ? (
        <Item variant="outline" asChild className={cn(className, "h-[120px]")}>
            <Link href={href}>{body}</Link>
        </Item>
    ) : (
        <Item variant="outline" className={cn(className, "h-[120px]")}>
            {body}
        </Item>
    );
}

export function StatCardSkeleton({ className }: { className?: string }) {
    return <div className={cn("h-[120px] animate-pulse bg-muted rounded-lg", className)} />;
}
