/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { SendIcon } from "lucide-react";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { usersEffects } from "@/client/users-effects";
import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
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
import { ObjectName } from "@/components/ui/typography";
import { useLogger } from "@/hooks/use-logger";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type Invitation = RouterOutput["users"]["listInvitations"][number];

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
                        <Invitation_Item key={invitation.id} invitation={invitation} />
                    ))}
                </Show>
            </CardContent>
        </Card>
    );
}

/**
 * Placeholder for `Invitations_Card` while it streams in behind its own `<Suspense>`
 * boundary — see `user/page.tsx`.
 */
export function Invitations_Skeleton() {
    return (
        <Card aria-busy="true" aria-label="Loading invitations">
            <CardHeader>
                <Skeleton className="h-6 w-1/3" />
            </CardHeader>
            <CardContent className="space-y-3">
                {Array.from({ length: 2 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <Skeleton className="size-5 rounded" />
                        <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-1/4" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function Invitation_Item({ invitation }: { invitation: Invitation }) {
    const logger = useLogger("Common", "Invitation_Item");

    const acceptMutation = useMutation(
        trpc.users.acceptInvitation.mutationOptions({
            meta: { effects: usersEffects.acceptInvitation },
            onError(error) {
                logger.error("Failed to accept invitation", error);
                toast.error(`Failed to accept invitation: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Joined <ObjectName>{invitation.organization.name}</ObjectName>
                    </>,
                );
            },
        }),
    );

    const rejectMutation = useMutation(
        trpc.users.rejectInvitation.mutationOptions({
            meta: { effects: usersEffects.rejectInvitation },
            onError(error) {
                logger.error("Failed to reject invitation", error);
                toast.error(`Failed to reject invitation: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Rejected invitation to{" "}
                        <ObjectName>{invitation.organization.name}</ObjectName>
                    </>,
                );
            },
        }),
    );

    const busy = acceptMutation.isPending || rejectMutation.isPending;
    const input = { invitationId: invitation.id };

    return (
        <Item>
            <ItemMedia>
                <SendIcon className="size-5" />
            </ItemMedia>
            <ItemContent>
                <ItemTitle>{invitation.organization.name}</ItemTitle>
                <ItemDescription>Invitation</ItemDescription>
            </ItemContent>
            <ItemActions>
                <MutationButton
                    type="button"
                    size="sm"
                    status={acceptMutation.status}
                    disabled={busy}
                    text={{ idle: "Accept", pending: "Accepting", success: "Accepted" }}
                    onClick={() => acceptMutation.mutate(input)}
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || acceptMutation.isSuccess}
                    onClick={() => rejectMutation.mutate(input)}
                >
                    Reject
                </Button>
            </ItemActions>
        </Item>
    );
}
