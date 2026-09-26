/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Route } from "next";
import Link from "next/link";
import { ComponentProps, ReactNode } from "react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export type EntityLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
    href: Route;
    title: string;
    type: string;
    children?: ReactNode;
};

export function EntityLink({ href, title, type, children, className, ...props }: EntityLinkProps) {
    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <Link {...props} href={href} className={cn("hover:underline", className)}>
                    {title}
                </Link>
            </HoverCardTrigger>
            <HoverCardContent>
                <span className="text-xs text-muted-foreground">{type}</span>
                <span className="font-medium">{title}</span>
                {children}
            </HoverCardContent>
        </HoverCard>
    );
}
