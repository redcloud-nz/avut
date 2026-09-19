/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Building2Icon, ChevronsUpDown, ShieldIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSuspenseQuery } from "@tanstack/react-query";

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

import { useUser } from "@/client/auth-queries";
import { trpc } from "@/trpc/client";

/** Which of the three scope roots the current pathname is inside, or `null` for a route above all of them. */
function useCurrentScope(): "organization" | "user" | "system" | null {
    const pathname = usePathname();
    if (pathname.startsWith("/orgs/")) return "organization";
    if (pathname === "/user" || pathname.startsWith("/user/")) return "user";
    if (pathname === "/system" || pathname.startsWith("/system/")) return "system";
    return null;
}

/**
 * Placeholder for `ScopeSwitcher` — the `<Suspense>` fallback in `(authenticated)/layout.tsx`.
 * Deliberately not `SidebarMenuSkeleton`: that picks a random width per render, which never
 * matches between the server HTML and hydration.
 */
export function ScopeSwitcher_Skeleton() {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <Skeleton className="h-12 w-full" />
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

/**
 * Always-rendered scope switcher: the persistent indicator of which of the three scope roots
 * (an organization, the user's own `/user`, or the site-wide `/system`) the current route is
 * in, and a way to jump directly to any of them. Replaces the old org-only module switcher
 * (`OrgModuleListMenu`) — module-level navigation within a scope is a separate concern, not
 * this component's job.
 */
export function ScopeSwitcher() {
    const scope = useCurrentScope();
    const pathname = usePathname();
    const { data: user } = useUser();
    const { data: memberships } = useSuspenseQuery(trpc.users.listMemberships.queryOptions());

    if (!user) return <ScopeSwitcher_Skeleton />;

    const currentOrgSlug = scope === "organization" ? pathname.split("/")[2] : undefined;
    const currentMembership = memberships.find((m) => m.organization.slug === currentOrgSlug);

    const CurrentIcon =
        scope === "user" ? UserIcon : scope === "system" ? ShieldIcon : Building2Icon;
    const currentLabel =
        scope === "user"
            ? "Personal Account"
            : scope === "system"
              ? "System"
              : (currentMembership?.organization.name ?? "Select organisation");

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <div className="flex size-6 items-center justify-center rounded-full bg-sidebar-accent">
                                <CurrentIcon className="size-4" />
                            </div>
                            <div className="font-semibold text-md truncate">{currentLabel}</div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Organisations</DropdownMenuLabel>
                            {memberships.map((membership) => (
                                <DropdownMenuItem key={membership.organization.id} asChild>
                                    <Link href={`/orgs/${membership.organization.slug}`}>
                                        <Building2Icon />
                                        {membership.organization.name}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <Link href="/user">
                                    <UserIcon />
                                    Personal Account
                                </Link>
                            </DropdownMenuItem>
                            {user.role === "admin" && (
                                <DropdownMenuItem asChild>
                                    <Link href="/system/admin">
                                        <ShieldIcon />
                                        System Admin
                                    </Link>
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
