/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { personnelEffects } from "@/client/personnel-effects";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export function AdminModule_RestorePerson_Dialog({
    person,
    ...props
}: DialogProps & { person: PersonData }) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.personnel.restorePerson.mutationOptions({
            meta: { effects: personnelEffects.restorePerson },
            onError(error) {
                console.error("Failed to restore person:", error);
                toast.error(`Failed to restore person: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Person <ObjectName>{person.name}</ObjectName> restored.
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) {
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Restore Person</DialogTitle>
                    <DialogDescription>
                        Restore <ObjectName>{person.name}</ObjectName> to Active status.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Restore",
                            pending: "Restoring",
                            success: "Restored",
                        }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                personId: person.id,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
