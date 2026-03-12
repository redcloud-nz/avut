/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRight } from "lucide-react";
import { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ComponentProps, ReactNode, useState } from "react";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

interface NavItemProps<T extends string> extends Omit<
    ComponentProps<typeof SidebarMenuItem>,
    "children"
> {
    icon?: ReactNode;
    size?: ComponentProps<typeof SidebarMenuButton>["size"];
    label: string;
    href: Route<T>;
}

export function NavItem<T extends string>({
    href,
    icon,
    label,
    size = "default",
    ...props
}: NavItemProps<T>) {
    const pathname = usePathname();

    return (
        <SidebarMenuItem {...props}>
            <SidebarMenuButton asChild size={size} isActive={pathname == href}>
                <Link href={href}>
                    {icon}
                    <span>{label}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

interface NavCollapsibleProps<T extends string> extends Omit<
    ComponentProps<typeof Collapsible>,
    "asChild" | "open" | "onOpenChange"
> {
    icon?: ReactNode;
    label: string;
    href: Route<T>;
}

export function NavCollapsible<T extends string>({
    children,
    className,
    icon,
    label,
    href,
    ...props
}: NavCollapsibleProps<T>) {
    const pathname = usePathname();

    const [open, setOpen] = useState<boolean>(false);

    const isActive = pathname == href;

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
                <SidebarMenuButton tooltip={label} asChild>
                    <Link href={href}>
                        {icon}
                        <span>{label}</span>
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

interface NavSubItemProps<T extends string> extends Omit<
    ComponentProps<typeof SidebarMenuSubItem>,
    "children"
> {
    icon?: ReactNode;
    label: string;
    href: Route<T>;
}

export function NavSubItem<T extends string>({
    href,
    icon,
    label,
    ...props
}: NavSubItemProps<T>) {
    const pathname = usePathname();

    return (
        <SidebarMenuSubItem {...props}>
            <SidebarMenuSubButton asChild isActive={pathname == href}>
                <Link href={href}>
                    {icon}
                    <span>{label}</span>
                </Link>
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    );
}

// export function NavSectionHeadingLink({
//     children,
//     ...props
// }: ComponentProps<typeof Link>) {
//     return (
//         <Button variant="ghost" className="w-full h-8 pl-0 border-0" asChild>
//             <Link {...props}>
//                 <div className="truncate font-semibold text-center">
//                     {children}
//                 </div>
//             </Link>
//         </Button>
//     );
// }
