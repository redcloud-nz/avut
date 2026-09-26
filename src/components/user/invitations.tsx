/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { SendIcon } from "lucide-react";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { userEffects } from "@/client/user-effects";
import { RejectInvitation_Dialog } from "@/components/invitations/reject-invitation-dialog";
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

type Invitation = RouterOutput["user"]["listInvitations"][number];

export function Invitations_Card() {
    const { data: invitations } = useSuspenseQuery(trpc.user.listInvitations.queryOptions());

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["reject"] as const));
    const [invitationId, setInvitationId] = useQueryState("invitationId", parseAsString);
    const activeInvitation = invitations.find((i) => i.id === invitationId) ?? null;

    function openReject(id: Invitation["id"]) {
        void setInvitationId(id, { history: "push" });
        void setAction("reject", { history: "push" });
    }
    function closeReject() {
        void setAction(null, { history: "replace" });
        void setInvitationId(null, { history: "replace" });
    }

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
                        <Invitation_Item
                            key={invitation.id}
                            invitation={invitation}
                            onDecline={() => openReject(invitation.id)}
                        />
                    ))}
                </Show>
            </CardContent>
            {activeInvitation && (
                <RejectInvitation_Dialog
                    invitation={{
                        id: activeInvitation.id,
                        organizationName: activeInvitation.organization.name,
                    }}
                    open={action === "reject"}
                    onOpenChange={(open) => (open ? undefined : closeReject())}
                />
            )}
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

function Invitation_Item({
    invitation,
    onDecline,
}: {
    invitation: Invitation;
    onDecline: () => void;
}) {
    const logger = useLogger("Common", "Invitation_Item");

    const acceptMutation = useMutation(
        trpc.user.acceptInvitation.mutationOptions({
            meta: { effects: userEffects.acceptInvitation },
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
                    disabled={acceptMutation.isPending}
                    text={{ idle: "Accept", pending: "Accepting", success: "Accepted" }}
                    onClick={() => acceptMutation.mutate({ invitationId: invitation.id })}
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={acceptMutation.isPending || acceptMutation.isSuccess}
                    onClick={onDecline}
                >
                    Reject
                </Button>
            </ItemActions>
        </Item>
    );
}
