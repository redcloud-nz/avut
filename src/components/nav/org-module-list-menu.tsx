/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ChevronsUpDown } from "lucide-react";

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
import { useOrganization } from "@/hooks/use-organization";
import { Show } from "../show";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { globalModules, moduleBySegment, orgModules } from "@/lib/modules";
import { useUser } from "@/client/auth-queries";

function useCurrentModule() {
    // Org paths are /orgs/<slug>/<module>/...
    const segment = usePathname().split("/")[3];
    return segment ? moduleBySegment[segment] : undefined;
}

/** Module switcher for the org scope — only usable within an `OrganizationProvider`. */
export function OrgModuleListMenu() {
    const currentModule = useCurrentModule();
    const CurrentIcon = currentModule?.icon;

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            {CurrentIcon && <CurrentIcon className="size-4" />}
                            <div className="font-semibold text-md">
                                {currentModule?.label ?? "Dashboard"}
                            </div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Modules</DropdownMenuLabel>
                            <OrganizationModuleOptions />
                            {/* Global modules are admin-only; they follow the org modules
                                under a divider. */}
                            <GlobalModuleOptions separated />
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

function OrganizationModuleOptions() {
    const organization = useOrganization();

    return (
        <>
            {orgModules.map((mod) => {
                const enabled = organization.isModuleEnabled(mod.id);
                const Icon = mod.icon;

                return (
                    <Show key={mod.id} when={enabled}>
                        <DropdownMenuItem asChild>
                            <Link href={mod.href(organization.slug)}>
                                <Icon />
                                {mod.label}
                            </Link>
                        </DropdownMenuItem>
                    </Show>
                );
            })}
        </>
    );
}

function GlobalModuleOptions({ separated = false }: { separated?: boolean }) {
    const { data: user } = useUser();

    // The admin check is invariant across the list, so gate once up front rather
    // than per item — avoids rendering an empty dropdown group for non-admins.
    if (user?.role !== "admin" || globalModules.length === 0) return null;

    return (
        <>
            {separated && (
                <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Global</DropdownMenuLabel>
                </>
            )}
            {globalModules.map((mod) => {
                const Icon = mod.icon;

                return (
                    <DropdownMenuItem key={mod.id} asChild>
                        <Link href={mod.href()}>
                            <Icon />
                            {mod.label}
                        </Link>
                    </DropdownMenuItem>
                );
            })}
        </>
    );
}
