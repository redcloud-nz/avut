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

export function AdminModule_LinkPerson_Dialog({
    userId,
    userName,
    ...props
}: DialogProps & { userId: UserId; userName: string }) {
    return (
        <Dialog {...props}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Link Person</DialogTitle>
                    <DialogDescription>
                        Link a personnel record to user <ObjectName>{userName}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <LinkPerson_Body
                        userId={userId}
                        userName={userName}
                        onDone={() => props.onOpenChange?.(false)}
                    />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function LinkPerson_Body({
    userId,
    userName,
    onDone,
}: {
    userId: UserId;
    userName: string;
    onDone: () => void;
}) {
    const organization = useOrganization();

    const [personId, setPersonId] = useState<string | null>(null);

    const { data: unlinkedPersonnel } = useSuspenseQuery(
        trpc.personnel.listUnlinkedPersonnel.queryOptions({ organizationId: organization.id }),
    );

    const mutation = useMutation(
        trpc.users.linkPerson.mutationOptions({
            meta: { effects: usersEffects.linkPerson },
            onError(error) {
                console.error("Failed to link person:", error);
                toast.error(`Failed to link person: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Person linked to user <ObjectName>{userName}</ObjectName>.
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
                        <FieldLabel>Person</FieldLabel>
                        <SearchableSelect
                            value={personId}
                            onValueChange={setPersonId}
                            options={unlinkedPersonnel.map((person) => ({
                                value: person.id,
                                label: `${person.name} (${person.email})`,
                            }))}
                            placeholder="Select a person to link"
                            searchPlaceholder="Search personnel..."
                            emptyMessage="No unlinked personnel found."
                        />
                    </Field>
                </FieldGroup>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="button"
                    disabled={!personId}
                    onClick={() => {
                        if (!personId) return;
                        mutation.mutate({
                            organizationId: organization.id,
                            userId,
                            personId: PersonId.schema.parse(personId),
                        });
                    }}
                    status={mutation.status}
                    text={{
                        idle: "Link Person",
                        pending: "Linking Person",
                        success: "Person Linked",
                    }}
                />
            </DialogFooter>
        </>
    );
}
