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
    href: Route;
    className?: string;
}) {
    return (
        <Item variant="outline" asChild className={className}>
            <Link href={href}>
                <ItemHeader className="justify-between">
                    <ItemMedia>
                        <Icon className="size-8 text-muted-foreground" />
                    </ItemMedia>
                    <ItemTitle className="w-14 text-2xl font-semibold">{value}</ItemTitle>
                </ItemHeader>
                <ItemDescription>{label}</ItemDescription>
            </Link>
        </Item>
    );
}
