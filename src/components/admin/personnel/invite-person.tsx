/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import {
    InvitationRoleFields,
    invitationRoles,
    invitationRolesSchema,
} from "@/components/admin/invitations/invitation-role-fields";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { ObjectName } from "@/components/ui/typography";

import { usersEffects } from "@/client/users-effects";
import { useOrganization } from "@/hooks/use-organization";
import { formatRelativeDateTime } from "@/lib/datetime";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

/**
 * `?action=invite` dialog on the person detail page — gets this person a user account without
 * retyping their email.
 *
 * Two outcomes behind one action, chosen by `personnel.getInviteState`:
 *
 * - **Link.** A user with this email is already a member of the organization. better-auth refuses
 *   an invitation in that case (`USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION`), and linking is
 *   what the admin wanted anyway, so the dialog offers `users.linkPerson` instead.
 * - **Neither.** That member's account is already linked to a different person
 *   (`MemberLinkedElsewhere`). An invitation would be refused and linking would steal the other
 *   person's account, so the dialog explains and offers only Cancel.
 * - **Invite.** Otherwise send an invitation carrying `personId`, which
 *   `organizationHooks.afterAcceptInvitation` copies onto the membership when it is accepted.
 *
 * Host-driven (Recipe C of `docs/patterns/mutation-dialog.md`): the link outcome hides the menu
 * action that opened this dialog, so it must not own the `action` param itself — a dialog may only
 * do that if it outlives its own mutation's success.
 */
export function AdminModule_InvitePerson_Dialog({
    person,
    ...props
}: DialogProps & { person: PersonData }) {
    return (
        <Dialog {...props}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                {/* The header depends on `getInviteState`, so it lives in the body component; this
                    neutral one covers loading and a failed load. Radix only mounts the body while
                    the dialog is open, which also keeps the query and form state fresh per open. */}
                <DialogBoundary
                    fallbackHeader={
                        <DialogHeader>
                            <DialogTitle>Invite to AVUT</DialogTitle>
                            <DialogDescription>
                                <ObjectName>{person.email}</ObjectName>
                            </DialogDescription>
                        </DialogHeader>
                    }
                >
                    <InvitePerson_Body person={person} close={() => props.onOpenChange?.(false)} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function InvitePerson_Body({ person, close }: { person: PersonData; close: () => void }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const inviteStateQueryOptions = trpc.personnel.getInviteState.queryOptions({
        organizationId: organization.id,
        personId: person.id,
    });

    const { data: inviteState } = useSuspenseQuery(inviteStateQueryOptions);

    const form = useForm({
        resolver: zodResolver(invitationRolesSchema),
        defaultValues: { primaryRole: "member", secondaryRoles: [] } as const,
    });

    function invalidateInviteState() {
        void queryClient.invalidateQueries({ queryKey: inviteStateQueryOptions.queryKey });
    }

    const inviteMutation = useMutation({
        mutationFn: async (roles: OrganizationRole[]) =>
            await authClient.organization.inviteMember(
                {
                    // Lowercased to match how better-auth stores `User.email` at sign-up. An
                    // invitation kept at the person record's own casing would never be found by
                    // the dashboard's invitation lookup, which looks invitations up by the
                    // session user's (lowercase) email.
                    email: person.email.toLowerCase(),
                    role: roles,
                    organizationId: organization.id,
                    personId: person.id,
                    resend: false,
                },
                { throw: true },
            ),
        onError(error) {
            console.error("Failed to send invitation:", error);
            toast.error(`Failed to send invitation: ${error.message}`);
        },
        onSuccess() {
            toast.success(
                <>
                    Invitation sent to <ObjectName>{person.email}</ObjectName>.
                </>,
            );

            void queryClient.invalidateQueries({
                queryKey: ["auth", "organization-invitations", organization.id],
            });
            invalidateInviteState();

            close();
        },
    });

    const linkMutation = useMutation(
        trpc.users.linkPerson.mutationOptions({
            meta: { effects: usersEffects.linkPerson },
            onError(error) {
                console.error("Failed to link person:", error);
                toast.error(`Failed to link person: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        <ObjectName>{person.name}</ObjectName> linked to their user account.
                    </>,
                );

                close();
            },
        }),
    );

    const alreadyMember = inviteState.state === "AlreadyMember";
    // A member holds this email, but their account is already linked to a different person.
    // Neither action is available — see `getInviteState`'s output docs.
    const linkedElsewhere = inviteState.state === "MemberLinkedElsewhere";

    return (
        <>
            <DialogHeader>
                <DialogTitle>
                    {linkedElsewhere
                        ? "Account Already Linked"
                        : alreadyMember
                          ? "Link User Account"
                          : "Invite to AVUT"}
                </DialogTitle>
                <DialogDescription>
                    {linkedElsewhere ? (
                        <>
                            <ObjectName>{person.email}</ObjectName> belongs to a member of{" "}
                            <ObjectName>{organization.name}</ObjectName>, but that account is
                            already linked to a different person record. Unlink it there first if it
                            should belong to this person.
                        </>
                    ) : alreadyMember ? (
                        <>
                            <ObjectName>{person.email}</ObjectName> already belongs to a member of{" "}
                            <ObjectName>{organization.name}</ObjectName>. Link that account to this
                            person record instead of sending an invitation.
                        </>
                    ) : (
                        <>
                            Invite <ObjectName>{person.email}</ObjectName> to join{" "}
                            <ObjectName>{organization.name}</ObjectName>. Accepting the invitation
                            links their account to this person record.
                        </>
                    )}
                </DialogDescription>
            </DialogHeader>
            <DialogBody>
                {inviteState.state === "Linked" ? (
                    <FieldDescription>
                        This person is already linked to a user account.
                    </FieldDescription>
                ) : alreadyMember || linkedElsewhere ? (
                    <FieldDescription>
                        Account: <ObjectName>{inviteState.user?.name}</ObjectName>
                    </FieldDescription>
                ) : (
                    <FormProvider {...form}>
                        <form
                            id="invite-person-form"
                            onSubmit={form.handleSubmit(
                                (data) => inviteMutation.mutate(invitationRoles(data)),
                                (errors) => console.error("Form validation errors:", errors),
                            )}
                        >
                            <FieldGroup>
                                {inviteState.state === "UserExists" && (
                                    <FieldDescription>
                                        They already have an AVUT account but are not a member of
                                        this organisation yet.
                                    </FieldDescription>
                                )}
                                {inviteState.pendingInvitation && (
                                    <FieldDescription>
                                        An invitation is already pending (sent{" "}
                                        {formatRelativeDateTime(
                                            inviteState.pendingInvitation.createdAt,
                                        )}
                                        ). Sending a new one replaces it.
                                    </FieldDescription>
                                )}
                                <InvitationRoleFields />
                            </FieldGroup>
                        </form>
                    </FormProvider>
                )}
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                {linkedElsewhere ? null : alreadyMember ? (
                    <MutationButton
                        type="button"
                        status={linkMutation.status}
                        disabled={!inviteState.user}
                        onClick={() => {
                            if (!inviteState.user) return;
                            linkMutation.mutate({
                                organizationId: organization.id,
                                userId: inviteState.user.id,
                                personId: person.id,
                            });
                        }}
                        text={{
                            idle: "Link Account",
                            pending: "Linking Account",
                            success: "Account Linked",
                        }}
                    />
                ) : (
                    <MutationButton
                        type="submit"
                        form="invite-person-form"
                        status={inviteMutation.status}
                        disabled={inviteState.state === "Linked"}
                        text={{
                            idle: "Send Invitation",
                            pending: "Sending Invitation",
                            success: "Invitation Sent",
                        }}
                    />
                )}
            </DialogFooter>
        </>
    );
}
