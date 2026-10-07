/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { usersEffects } from "@/client/users-effects";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

export function AdminModule_LinkUser_Dialog({
    person,
    ...props
}: DialogProps & { person: { id: PersonId; name: string } }) {
    return (
        <Dialog {...props}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Link to User</DialogTitle>
                    <DialogDescription>
                        Link a user account to person <ObjectName>{person.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <LinkUser_Body person={person} onDone={() => props.onOpenChange?.(false)} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function LinkUser_Body({
    person,
    onDone,
}: {
    person: { id: PersonId; name: string };
    onDone: () => void;
}) {
    const organization = useOrganization();

    const [userId, setUserId] = useState<string | null>(null);

    const { data: unlinkedMembers } = useSuspenseQuery(
        trpc.users.listUnlinkedMembers.queryOptions({ organizationId: organization.id }),
    );

    const mutation = useMutation(
        trpc.users.linkPerson.mutationOptions({
            meta: { effects: usersEffects.linkPerson },
            onError(error) {
                console.error("Failed to link user:", error);
                toast.error(`Failed to link user: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        User linked to person <ObjectName>{person.name}</ObjectName>.
                    </>,
                );

                onDone();
            },
        }),
    );

    return (
        <>
            <DialogBody>
                <FieldGroup>
                    <Field>
                        <FieldLabel>User</FieldLabel>
                        <SearchableSelect
                            value={userId}
                            onValueChange={setUserId}
                            options={unlinkedMembers.map((member) => ({
                                value: member.userId,
                                label: `${member.name} (${member.email})`,
                            }))}
                            placeholder="Select a user to link"
                            searchPlaceholder="Search users..."
                            emptyMessage="No unlinked users found."
                        />
                    </Field>
                </FieldGroup>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="button"
                    disabled={!userId}
                    onClick={() => {
                        if (!userId) return;
                        mutation.mutate({
                            organizationId: organization.id,
                            userId: UserId.schema.parse(userId),
                            personId: person.id,
                        });
                    }}
                    status={mutation.status}
                    text={{
                        idle: "Link User",
                        pending: "Linking User",
                        success: "User Linked",
                    }}
                />
            </DialogFooter>
        </>
    );
}
