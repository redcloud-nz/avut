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
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ExternalLink, Link } from "@/components/ui/link";
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type NavSectionProps = ComponentProps<typeof SidebarGroup> & {
    title?: string;
};

export function NavSection({ title, children }: NavSectionProps) {
    return (
        <SidebarGroup>
            {title ? <SidebarGroupLabel>{title}</SidebarGroupLabel> : null}
            <SidebarMenu>{children}</SidebarMenu>
        </SidebarGroup>
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
    Omit<ComponentProps<typeof SidebarMenuItem>, "children"> & {
        icon?: ReactNode;
        size?: ComponentProps<typeof SidebarMenuButton>["size"];
    };

export function NavItem({
    external,
    href,
    icon,
    label,
    path,
    size = "default",
    ...props
}: NavItemProps) {
    const pathname = usePathname();

    if (external) {
        return (
            <SidebarMenuItem {...props}>
                <SidebarMenuButton asChild size={size}>
                    <ExternalLink href={href} noDecoration>
                        {icon}
                        <span>{label}</span>
                    </ExternalLink>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    } else {
        return (
            <SidebarMenuItem {...props}>
                <SidebarMenuButton
                    asChild
                    isActive={pathname == path.href}
                    size={size}
                >
                    <Link to={path}>
                        {icon}
                        <span>{label ?? path.label}</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    }
}

type NavCollapsibleProps = Omit<
    ComponentProps<typeof Collapsible>,
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
            <SidebarMenuItem>
                <SidebarMenuButton tooltip={path.label} asChild>
                    <Link to={path}>
                        {icon}
                        <span>{path.label}</span>
                    </Link>
                </SidebarMenuButton>
                <CollapsibleTrigger asChild>
                    <SidebarMenuAction>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuAction>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>{children}</SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
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
    Omit<ComponentProps<typeof SidebarMenuSubItem>, "children"> & {
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
            <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild>
                    <ExternalLink href={href} noDecoration>
                        {icon}
                        <span>{label}</span>
                    </ExternalLink>
                </SidebarMenuSubButton>
            </SidebarMenuSubItem>
        );
    } else {
        return (
            <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild isActive={pathname == path.href}>
                    <Link to={path}>
                        {icon}
                        <span>{label ?? path.label}</span>
                    </Link>
                </SidebarMenuSubButton>
            </SidebarMenuSubItem>
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
