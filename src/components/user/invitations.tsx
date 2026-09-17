/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { SendIcon } from "lucide-react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

import { trpc } from "@/trpc/client";

export function Invitations_Card() {
    const { data: invitations } = useSuspenseQuery(trpc.users.listInvitations.queryOptions());

    return (
        <Card>
            <CardHeader>
                <CardTitle>Invitations</CardTitle>
            </CardHeader>
            <CardContent>
                <Show
                    when={invitations.length > 0}
                    fallback={
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>No Pending Invitations</EmptyTitle>
                                <EmptyDescription>
                                    You don&apos;t have any pending organisation invitations right
                                    now.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    }
                >
                    {invitations.map((invitation) => (
                        <Item key={invitation.id}>
                            <ItemMedia>
                                <SendIcon className="size-5" />
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle>{invitation.organization.name}</ItemTitle>
                                <ItemDescription>Invitation</ItemDescription>
                            </ItemContent>
                        </Item>
                    ))}
                </Show>
            </CardContent>
        </Card>
    );
}
