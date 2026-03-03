/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
    useMutation,
    useQueryClient,
    useSuspenseQueries,
} from "@tanstack/react-query";

import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

import { OrganizationRole } from "@/lib/schemas/organization-role";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export default function Auth_ViewInvitation_Dialog({
    invitationId,
    ...props
}: DialogProps & { invitationId: InvitationId }) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const [{ data: invitation }] = useSuspenseQueries({
        queries: [
            trpc.invitations.getInvitation.queryOptions({
                invitationId: invitationId,
            }),
        ],
    });

    const acceptMutation = useMutation(
        trpc.invitations.acceptInvitation.mutationOptions({
            async onError(error) {
                console.error("Failed to accept invitation", error);
                toast.error("Failed to accept invitation: " + error.message);
            },
            async onSuccess() {
                props.onOpenChange?.(false);

                router.push(
                    Paths.org(invitation.organization.slug).dashboard.href,
                );

                queryClient.invalidateQueries(
                    trpc.invitations.getInvitation.queryFilter({
                        invitationId: invitationId,
                    }),
                );
            },
        }),
    );
    const rejectMutation = useMutation(
        trpc.invitations.rejectInvitation.mutationOptions({
            async onError(error) {
                console.error("Failed to reject invitation", error);
                toast.error("Failed to reject invitation: " + error.message);
            },
            async onSuccess() {
                props.onOpenChange?.(false);

                queryClient.invalidateQueries(
                    trpc.invitations.getInvitation.queryFilter({
                        invitationId: invitationId,
                    }),
                );
            },
        }),
    );

    return (
        <Dialog {...props}>
            <DialogHeader>
                <DialogTitle>Invitation Details</DialogTitle>
            </DialogHeader>
            <DialogContent>
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
                                        OrganizationRole.displayNames[role],
                                )
                                .join(", ")}
                        </FieldValue>
                    </Field>
                    <Field orientation="responsive">
                        <FieldLabel>Created</FieldLabel>
                        <FieldValue
                            className="min-w-1/2"
                            format="dateTimeWithDistance"
                            value={invitation.createdAt}
                        />
                    </Field>
                </FieldGroup>
                <DialogFooter>
                    <MutationButton
                        onClick={() =>
                            acceptMutation.mutate({
                                invitationId: invitationId,
                            })
                        }
                        status={acceptMutation.status}
                        text={{
                            idle: "Accept",
                            pending: "Accepting",
                            success: "Accepted",
                        }}
                    />
                    <MutationButton
                        variant="outline"
                        onClick={() =>
                            rejectMutation.mutate({
                                invitationId: invitationId,
                            })
                        }
                        status={rejectMutation.status}
                        text={{
                            idle: "Reject",
                            pending: "Rejecting",
                            success: "Rejected",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
