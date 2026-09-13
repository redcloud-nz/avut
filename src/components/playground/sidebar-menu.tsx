/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import type { Route } from "next";

import { NavItem } from "@/components/nav/nav-section";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu } from "@/components/ui/sidebar";

import { route } from "@/lib/routes";

import { useOrganization } from "@/hooks/use-organization";

import { playgroundRegistry } from "@/app/(wrapper)/(authenticated)/orgs/[slug]/playground/_registry";

export function Playground_Sidebar_Menu() {
    const { slug } = useOrganization();

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Playground</SidebarGroupLabel>
            <SidebarMenu>
                <NavItem label="Index" href={route("/orgs/[slug]/playground", { slug })} />
                {playgroundRegistry.map((entry) => (
                    <NavItem
                        key={entry.slug}
                        label={entry.title}
                        // Registry slugs are dynamic, so the typed route() helper
                        // can't build these — the concrete folders under
                        // playground/ keep them valid at runtime.
                        href={`/orgs/${slug}/playground/${entry.slug}` as Route}
                    />
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
