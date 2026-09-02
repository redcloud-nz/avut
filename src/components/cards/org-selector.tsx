/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import Link from "next/link";
import { Building2Icon, ChevronRightIcon, SendIcon } from "lucide-react";

import { Show } from "@/components/show";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";

import { globalModules } from "@/lib/modules";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { EntryControlSelect } from "@/server/entry-control";

export function OrgSelector_Card({
    entryControl,
    module,
}: {
    entryControl: EntryControlSelect;
    module?: string;
}) {
    const { session, memberships, invitations } = entryControl.data;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Select organization to use</CardTitle>
                <CardDescription>
                    Signed in as <br />
                    {session.user.name} ({session.user.email}).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Show
                    when={memberships.length > 0}
                    fallback={
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>No Organization Memberships</EmptyTitle>
                                <EmptyDescription>
                                    You do not have access to any organizations yet.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    }
                >
                    {memberships.map((membership) => (
                        <Item key={membership.organization.id} asChild>
                            <Link
                                href={`/orgs/${membership.organization.slug}${module ? `/${module}` : ""}`}
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
                <Show when={invitations.length > 0}>
                    <div className="font-medium mt-4">Pending Invitations</div>

                    {invitations.map((invitation) => (
                        <Item key={invitation.id} asChild>
                            <ItemMedia>
                                <SendIcon className="size-5" />
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle>{invitation.organization.name}</ItemTitle>
                                <ItemDescription>Invitation</ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <ChevronRightIcon className="size-4" />
                            </ItemActions>
                        </Item>
                    ))}
                </Show>

                {/* Global (non-org) modules. Today these are all admin-gated, so a plain
                    role check is enough; a per-module permission model comes with the
                    "phantom global org" work. Gives a global admin with no/many org
                    memberships a way out of this screen. */}
                <Show when={session.user.role === "admin" && globalModules.length > 0}>
                    <div className="mt-4 mb-2 border-t pt-4 font-medium">Global</div>

                    {globalModules.map((mod) => {
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

                {/* <Separator />
                <Item asChild>
                    <Link to={Paths.orgs.create}>
                        <ItemContent>
                            <ItemTitle>New Organization</ItemTitle>
                        </ItemContent>
                        <ItemActions>
                            <PlusIcon className="size-4" />
                        </ItemActions>
                    </Link>
                </Item> */}
            </CardContent>
        </Card>
    );
}
