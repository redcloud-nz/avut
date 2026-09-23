/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ChevronsUpDown, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useSignOut } from "@/client/use-sign-out";
import { PersonalSettingsIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserInitials } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export function UserMenu_Skeleton() {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <Skeleton className="h-12 w-full" />
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

export function UserMenu() {
    const { data: session } = useSuspenseQuery(trpc.users.getSession.queryOptions());

    const signOut = useSignOut();

    if (!session) return null;

    const initials = getUserInitials(session.user.name);

    function handleSignOut() {
        toast.promise(signOut(), {
            loading: "Signing out...",
            success: "Signed out successfully",
            error: (error) => `Error signing out: ${error.message}`,
        });
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="size-6 rounded-full">
                                <AvatarImage
                                    src={session.user.image ?? ""}
                                    alt={session.user.name}
                                />
                                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">{session.user.name}</span>
                                <span className="truncate text-xs">{session.user.email}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        side="top"
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                <Avatar className="h-8 w-8 rounded-full">
                                    <AvatarImage
                                        src={session.user.image ?? ""}
                                        alt={session.user.name}
                                    />
                                    <AvatarFallback className="rounded-lg">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">
                                        {session.user.name}
                                    </span>
                                    <span className="truncate text-xs">{session.user.email}</span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Personal</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href="/user/settings">
                                    <PersonalSettingsIcon />
                                    <span>Settings</span>
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={handleSignOut}>
                                <LogOutIcon />
                                <span>Sign Out</span>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
