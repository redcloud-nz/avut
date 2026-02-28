/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /(authenticated)/auth/view-invitation/[invitation_id]
 */
"use client";

import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { use } from "react";
import { toast } from "sonner";

import {
    useMutation,
    useQueryClient,
    useSuspenseQueries,
} from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

import { sessionQueryOptions } from "@/lib/auth-client";
import { formatDate } from "@/lib/datetime";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export default function Auth_ViewInvitation_Page(
    props: PageProps<"/personal/invitations/[invitation_id]">,
) {
    const { invitation_id } = use(props.params);

    const queryClient = useQueryClient();
    const router = useRouter();

    const [{ data: session }, { data: invitation }] = useSuspenseQueries({
        queries: [
            sessionQueryOptions,
            trpc.invitations.getInvitation.queryOptions({
                invitationId: invitation_id,
            }),
        ],
    });

    if (!session) {
        // Not signed in, redirect to sign-in page with redirect back to this invite
        router.replace(
            Paths.auth.signIn({
                redirect: Paths.personal.invitation(invitation_id).href,
            }).href,
        );
    }

    const acceptMutation = useMutation(
        trpc.invitations.acceptInvitation.mutationOptions({
            async onSettled() {
                queryClient.invalidateQueries(
                    trpc.invitations.getInvitation.queryFilter({
                        invitationId: invitation_id,
                    }),
                );
            },
        }),
    );
    const rejectMutation = useMutation(
        trpc.invitations.rejectInvitation.mutationOptions({
            async onSettled() {
                queryClient.invalidateQueries(
                    trpc.invitations.getInvitation.queryFilter({
                        invitationId: invitation_id,
                    }),
                );
            },
        }),
    );

    function handleAccept() {
        toast.promise(
            async () => {
                await acceptMutation.mutateAsync({
                    invitationId: invitation_id,
                });
                router.push(
                    Paths.org(invitation.organization.slug).dashboard.href,
                );
            },
            {
                loading: "Accepting invitation...",
                success: "Invitation accepted.",
                error: (error) =>
                    "Failed to accept invitation: " + error.message,
            },
        );
    }

    function handleReject() {
        toast.promise(
            async () => {
                await rejectMutation.mutateAsync({
                    invitationId: invitation_id,
                });
                router.push(Paths.personal.invitations.href);
            },
            {
                loading: "Rejecting invitation...",
                success: "Invitation rejected.",
                error: (error) =>
                    "Failed to reject invitation: " + error.message,
            },
        );
    }

    const pending = acceptMutation.isPending || rejectMutation.isPending;

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.personal.index,
                    Paths.personal.invitations,
                    {
                        ...Paths.personal.invitation(invitation_id),
                        label: invitation_id,
                    },
                ]}
            />
            <Lexington.Column width="lg">
                <Hermes.Section>
                    <Hermes.Header>
                        <Hermes.BackButton to={Paths.personal.invitations}>
                            Invitations
                        </Hermes.BackButton>
                    </Hermes.Header>

                    <Card>
                        <CardHeader>
                            <CardTitle>Invitation Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Organization</FieldLabel>
                                    <FieldValue className="min-w-1/2">
                                        {invitation.organization.name}
                                    </FieldValue>
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Inviter</FieldLabel>
                                    <FieldValue className="min-w-1/2">
                                        {invitation.inviter.name}
                                        <span className="text-muted-foreground pl-2">
                                            ({invitation.inviter.email})
                                        </span>
                                    </FieldValue>
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Role</FieldLabel>
                                    <FieldValue className="min-w-1/2">
                                        {invitation.role
                                            .map(
                                                (role) =>
                                                    OrganizationRole
                                                        .displayNames[role],
                                            )
                                            .join(", ")}
                                    </FieldValue>
                                </Field>
                                <Field orientation="horizontal">
                                    <FieldLabel>Created</FieldLabel>
                                    <FieldValue
                                        className="min-w-1/2"
                                        format="dateTimeWithDistance"
                                        value={invitation.createdAt}
                                    />
                                </Field>

                                <Field orientation="horizontal">
                                    <Button
                                        onClick={handleAccept}
                                        disabled={pending}
                                    >
                                        Accept
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleReject}
                                        disabled={pending}
                                    >
                                        Decline
                                    </Button>
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                </Hermes.Section>
            </Lexington.Column>
        </Lexington.Root>
    );
}
