/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { RefObject, useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { teamUsersEffects } from "@/client/team-users-effects";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { TeamData } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

const SELECT_A_USER = "Select a user.";

type GrantTeamAccessProps = DialogProps & {
    team: TeamData;
    /** Where focus goes on close when the control that opened the dialog is gone. */
    returnFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * Grants a member of the organization access to a team (`?action=grant-access`), picking from the
 * members who don't have it yet. Host-driven: the Access card owns the param.
 */
export function Teams_GrantTeamAccess_Dialog({
    team,
    returnFocusRef,
    ...props
}: GrantTeamAccessProps) {
    const returnFocus = useReturnFocus(returnFocusRef);

    return (
        <Dialog {...props}>
            <DialogContent {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>Grant Access</DialogTitle>
                    <DialogDescription>
                        Select a user to give access to <ObjectName>{team.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <GrantTeamAccess_Body team={team} onDone={() => props.onOpenChange?.(false)} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function GrantTeamAccess_Body({ team, onDone }: { team: TeamData; onDone: () => void }) {
    const organization = useOrganization();

    const { data: grantableUsers } = useSuspenseQuery(
        trpc.teamUsers.listGrantableUsers.queryOptions({
            organizationId: organization.id,
            teamId: team.id,
        }),
    );

    const userOptions = grantableUsers.map((user) => ({
        value: user.id,
        label: user.name,
        subtitle: user.email,
    }));

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(
            z.object({
                userId: z
                    .string({ error: SELECT_A_USER })
                    .min(1, SELECT_A_USER)
                    .pipe(UserId.schema),
            }),
        ),
    });

    const mutation = useMutation(
        trpc.teamUsers.grantTeamAccess.mutationOptions({
            meta: { effects: teamUsersEffects.grantTeamAccess },
            onError(error) {
                console.error("Failed to grant team access:", error);
                toast.error(`Failed to grant team access: ${error.message}`);
            },
            onSuccess(_data, vars) {
                const user = grantableUsers.find((u) => u.id === vars.userId);
                toast.success(
                    <>
                        <ObjectName>{user?.name}</ObjectName> now has access to{" "}
                        <ObjectName>{team.name}</ObjectName>.
                    </>,
                );
                onDone();
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            mutation.mutate({
                organizationId: organization.id,
                teamId: team.id,
                userId: formData.userId,
            });
        },
        (errors) => {
            console.warn("Form validation errors:", errors);
        },
    );

    return (
        <>
            <DialogBody>
                <form id={formId} onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="userId"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${formId}-user`}>User</FieldLabel>
                                    <SearchableSelect
                                        id={`${formId}-user`}
                                        value={field.value ?? null}
                                        onValueChange={(value) =>
                                            field.onChange((value as UserId) || null)
                                        }
                                        options={userOptions}
                                        placeholder="Select a user"
                                        searchPlaceholder="Search users..."
                                        emptyMessage="No users to grant access to."
                                        aria-invalid={fieldState.invalid}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="submit"
                    form={formId}
                    status={mutation.status}
                    text={{ idle: "Grant", pending: "Granting", success: "Granted" }}
                />
            </DialogFooter>
        </>
    );
}
