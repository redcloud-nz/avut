/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { ComponentProps, ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleProps,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ExternalLink, Link } from "@/components/ui/link";
import {
    S2_SidebarGroup,
    S2_SidebarGroupLabel,
    S2_SidebarMenu,
    S2_SidebarMenuAction,
    S2_SidebarMenuButton,
    S2_SidebarMenuItem,
    S2_SidebarMenuSub,
    S2_SidebarMenuSubButton,
    S2_SidebarMenuSubItem,
} from "@/components/ui/s2-sidebar";
import { cn } from "@/lib/utils";

export type NavSectionProps = ComponentProps<typeof S2_SidebarGroup> & {
    title?: string;
};

export function NavSection({ title, children }: NavSectionProps) {
    return (
        <S2_SidebarGroup>
            {title ? (
                <S2_SidebarGroupLabel>{title}</S2_SidebarGroupLabel>
            ) : null}
            <S2_SidebarMenu>{children}</S2_SidebarMenu>
        </S2_SidebarGroup>
    );
}

type NavItemExternalProps = {
    external: true;
    href: string;
    path?: never;
    label: string;
};
type NavItemInternalProps = {
    external?: never;
    href?: never;
    path: { label: string; href: string };
    label?: string;
};
type NavItemProps = (NavItemExternalProps | NavItemInternalProps) &
    Omit<ComponentProps<typeof S2_SidebarMenuItem>, "children"> & {
        icon?: ReactNode;
    };

export function NavItem({
    external,
    href,
    icon,
    label,
    path,
    ...props
}: NavItemProps) {
    const pathname = usePathname();

    if (external) {
        return (
            <S2_SidebarMenuItem {...props}>
                <S2_SidebarMenuButton asChild>
                    <ExternalLink href={href} noDecoration>
                        {icon}
                        <span>{label}</span>
                    </ExternalLink>
                </S2_SidebarMenuButton>
            </S2_SidebarMenuItem>
        );
    } else {
        return (
            <S2_SidebarMenuItem {...props}>
                <S2_SidebarMenuButton asChild isActive={pathname == path.href}>
                    <Link to={path}>
                        {icon}
                        <span>{label ?? path.label}</span>
                    </Link>
                </S2_SidebarMenuButton>
            </S2_SidebarMenuItem>
        );
    }
}

type NavCollapsibleProps = Omit<
    CollapsibleProps,
    "asChild" | "open" | "onOpenChange"
> & {
    icon?: ReactNode;
    path: { label: string; href: string };
};

export function NavCollapsible({
    children,
    className,
    icon,
    path,
    ...props
}: NavCollapsibleProps) {
    const pathname = usePathname();

    const [open, setOpen] = useState<boolean>(false);

    const isActive = pathname == path.href;

    if (isActive && !open) {
        setOpen(true);
    }

    return (
        <Collapsible
            asChild
            className={cn("group/collapsible", className)}
            open={open || isActive}
            onOpenChange={setOpen}
            {...props}
        >
            <S2_SidebarMenuItem>
                <S2_SidebarMenuButton tooltip={path.label} asChild>
                    <Link to={path}>
                        {icon}
                        <span>{path.label}</span>
                    </Link>
                </S2_SidebarMenuButton>
                <CollapsibleTrigger asChild>
                    <S2_SidebarMenuAction>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </S2_SidebarMenuAction>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <S2_SidebarMenuSub>{children}</S2_SidebarMenuSub>
                </CollapsibleContent>
            </S2_SidebarMenuItem>
        </Collapsible>
    );
}

type NavSubItemExternalProps = {
    external: true;
    href: string;
    path?: never;
    label: string;
};
type NavSubItemInternalProps = {
    external?: never;
    href?: never;
    path: { label: string; href: string };
    label?: string;
};
type NavSubItemProps = (NavSubItemExternalProps | NavSubItemInternalProps) &
    Omit<ComponentProps<typeof S2_SidebarMenuSubItem>, "children"> & {
        icon?: ReactNode;
    };

export function NavSubItem({
    external,
    href,
    icon,
    label,
    path,
    ...props
}: NavSubItemProps) {
    const pathname = usePathname();

    if (external) {
        return (
            <S2_SidebarMenuSubItem>
                <S2_SidebarMenuSubButton asChild>
                    <ExternalLink href={href} noDecoration>
                        {icon}
                        <span>{label}</span>
                    </ExternalLink>
                </S2_SidebarMenuSubButton>
            </S2_SidebarMenuSubItem>
        );
    } else {
        return (
            <S2_SidebarMenuSubItem>
                <S2_SidebarMenuSubButton
                    asChild
                    isActive={pathname == path.href}
                >
                    <Link to={path}>
                        {icon}
                        <span>{label ?? path.label}</span>
                    </Link>
                </S2_SidebarMenuSubButton>
            </S2_SidebarMenuSubItem>
        );
    }
}

export function NavSectionHeadingLink({
    children,
    ...props
}: ComponentProps<typeof Link>) {
    return (
        <Button variant="ghost" className="w-full h-8 pl-0 border-0" asChild>
            <Link {...props}>
                <div className="truncate font-semibold text-center">
                    {children}
                </div>
            </Link>
        </Button>
    );
}
