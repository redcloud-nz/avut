/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Building2Icon, ChevronsUpDown, ShieldIcon, UserIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { useSuspenseQueries } from "@tanstack/react-query";

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
import { useCurrentScope } from "@/hooks/use-current-scope";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

const ScopeIcons = {
    user: UserIcon,
    system: ShieldIcon,
    organization: Building2Icon,
    team: UsersIcon,
} as const;

const ScopeLabels = {
    user: "Personal Account",
    system: "System",
    organization: "Select organisation",
    team: "Select team",
} as const;

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
 * Always-rendered scope switcher: the persistent indicator of which of the four scope roots
 * (an organization, a team the caller is granted, the user's own `/user`, or the site-wide
 * `/system`) the current route is in, and a way to jump directly to any of them. The Teams group
 * lists the caller's grants on slugged, Active teams (`user.listTeamGrants`) and is hidden when
 * there are none. Replaces the old org-only module switcher
 * (`OrgModuleListMenu`) — module-level navigation within a scope is a separate concern, not
 * this component's job.
 */
export function ScopeSwitcher() {
    const currentScope = useCurrentScope();

    const [{ data: session }, { data: memberships }, { data: teamGrants }] = useSuspenseQueries({
        queries: [
            trpc.user.getSession.queryOptions(),
            trpc.user.listMemberships.queryOptions(),
            trpc.user.listTeamGrants.queryOptions(),
        ],
    });

    // Name each team's org only when the caller is in more than one, so teams can't be confused.
    const showTeamOrg = memberships.length > 1;

    const CurrentIcon = currentScope ? ScopeIcons[currentScope.scope] : Building2Icon;
    let currentLabel: string;
    switch (currentScope?.scope) {
        case "user":
            currentLabel = ScopeLabels.user;
            break;
        case "system":
            currentLabel = ScopeLabels.system;
            break;
        case "team":
            currentLabel =
                teamGrants.find((g) => g.team.slug === currentScope.slug)?.team.name ??
                ScopeLabels.team;
            break;
        default:
            currentLabel =
                memberships.find((m) => m.organization.slug === currentScope?.slug)?.organization
                    .name ?? ScopeLabels.organization;
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
                            <div className="flex size-6 items-center justify-center rounded-full bg-sidebar-accent">
                                <CurrentIcon className="size-4" />
                            </div>
                            <div className="font-semibold text-md truncate">{currentLabel}</div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent size="trigger">
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
                        {teamGrants.length > 0 && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Teams</DropdownMenuLabel>
                                    {teamGrants.map((grant) => (
                                        <DropdownMenuItem key={grant.team.id} asChild>
                                            <Link
                                                href={route("/teams/[slug]", {
                                                    slug: grant.team.slug,
                                                })}
                                            >
                                                <UsersIcon />
                                                <span className="truncate">{grant.team.name}</span>
                                                {showTeamOrg && (
                                                    <span className="ml-auto truncate text-xs text-muted-foreground">
                                                        {grant.organization.name}
                                                    </span>
                                                )}
                                            </Link>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuGroup>
                            </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <Link href="/user">
                                    <UserIcon />
                                    Personal Account
                                </Link>
                            </DropdownMenuItem>
                            {session?.user.role === "admin" && (
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
