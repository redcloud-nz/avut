/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";
import { Building2Icon, ChevronRightIcon } from "lucide-react";

import { useSuspenseQuery } from "@tanstack/react-query";

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

import { systemModules } from "@/lib/modules";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { AuthSession } from "@/server/auth";
import { trpc } from "@/trpc/client";

export function OrgSelector_Card({ session }: { session: AuthSession }) {
    const { data: memberships } = useSuspenseQuery(trpc.users.listMemberships.queryOptions());

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
                            <Link href={`/orgs/${membership.organization.slug}`}>
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
                <Show when={session.user.role === "admin" && systemModules.length > 0}>
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
