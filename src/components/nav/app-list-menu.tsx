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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar";
import { ModuleIcons } from "../icons";
import { useOrganization } from "@/hooks/use-organization";
import { Show } from "../show";
import Link from "next/link";
import { route } from "@/lib/routes";

export function AppListMenu({ scope }: { scope: "personal" | "organization" }) {
    const { isMobile } = useSidebar();

    const organization = useOrganization();

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <div className="font-semibold text-md">Skill Package Builder</div>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Applications</DropdownMenuLabel>
                            {scope === "organization" ? (
                                <OrganizationAppOptions />
                            ) : (
                                <PersonalAppOptions />
                            )}
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

function OrganizationAppOptions() {
    const organization = useOrganization();

    const modules = organization.settings.modules;

    return (
        <>
            <DropdownMenuItem asChild>
                <Link href={route("/orgs/[slug]/admin", { slug: organization.slug })}>
                    <ModuleIcons.Admin />
                    Admin
                </Link>
            </DropdownMenuItem>
            <Show when={modules.i3.enabled}>
                <DropdownMenuItem asChild>
                    <Link href={route("/orgs/[slug]/i3", { slug: organization.slug })}>
                        <ModuleIcons.I3 />
                        I3
                    </Link>
                </DropdownMenuItem>
            </Show>
            <Show when={modules.skills.enabled}>
                <DropdownMenuItem asChild>
                    <Link href={route("/orgs/[slug]/skill-track", { slug: organization.slug })}>
                        <ModuleIcons.SkillTrack />
                        Skill Track
                    </Link>
                </DropdownMenuItem>
            </Show>
            <Show when={modules["skill-package-builder"].enabled}>
                <DropdownMenuItem asChild>
                    <Link
                        href={route("/orgs/[slug]/skill-package-builder", {
                            slug: organization.slug,
                        })}
                    >
                        <ModuleIcons.SkillPackageBuilder />
                        Skill Package Builder
                    </Link>
                </DropdownMenuItem>
            </Show>
        </>
    );
}

function PersonalAppOptions() {
    return <>TODO</>;
}
