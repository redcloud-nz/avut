/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Building2Icon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { systemModules } from "@/lib/modules";
import { route } from "@/lib/routes";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { trpc } from "@/trpc/client";

export function OrgSelector_Card() {
    const [{ data: session }, { data: memberships }] = useSuspenseQueries({
        queries: [trpc.users.getSession.queryOptions(), trpc.users.listMemberships.queryOptions()],
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Your organisations</CardTitle>
            </CardHeader>
            <CardContent>
                <Show
                    when={memberships.length > 0}
                    fallback={
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>No Organisation Memberships</EmptyTitle>
                                <EmptyDescription>
                                    You do not have access to any organisations yet.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    }
                >
                    {memberships.map((membership) => (
                        <Item key={membership.organization.id} asChild>
                            <Link
                                href={route("/orgs/[slug]", { slug: membership.organization.slug })}
                            >
                                <ItemMedia>
                                    <Building2Icon className="size-5" />
                                </ItemMedia>
                                <ItemContent>
                                    <ItemTitle>{membership.organization.name}</ItemTitle>
                                    <ItemDescription>
                                        {OrganizationRole.formatList(membership.roles)}
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                    ))}
                </Show>

                {/* System (non-org) modules. Today these are all admin-gated, so a plain
                    role check is enough; a per-module permission model comes with a
                    future per-user enable/configure split. Gives a system admin with
                    no/many org memberships a way out of this screen. */}
                <Show when={session?.user?.role === "admin" && systemModules.length > 0}>
                    <div className="mt-4 mb-2 border-t pt-4 font-medium">System</div>

                    {systemModules.map((mod) => {
                        const Icon = mod.icon;

                        return (
                            <Item key={mod.id} asChild>
                                <Link href={mod.href()}>
                                    <ItemMedia>
                                        <Icon className="size-5" />
                                    </ItemMedia>
                                    <ItemContent>
                                        <ItemTitle>{mod.label}</ItemTitle>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        );
                    })}
                </Show>
            </CardContent>
        </Card>
    );
}

/**
 * Placeholder for `OrgSelector_Card` while it streams in behind its own `<Suspense>`
 * boundary — see `user/page.tsx`.
 */
export function OrgSelector_Skeleton() {
    return (
        <Card aria-busy="true" aria-label="Loading organisations">
            <CardHeader>
                <Skeleton className="h-6 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-3">
                {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <Skeleton className="size-5 rounded" />
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-1/4" />
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
