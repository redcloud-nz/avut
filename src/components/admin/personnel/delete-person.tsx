/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { ComponentProps } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";

import { personnelEffects } from "@/client/personnel-effects";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export function AdminModule_DeletePerson_Dialog({
    person,
    ...props
}: ComponentProps<typeof AlertDialog> & { person: PersonData }) {
    const organization = useOrganization();
    const router = useRouter();

    const mutation = useMutation(
        trpc.personnel.deletePerson.mutationOptions({
            meta: { effects: personnelEffects.deletePerson },
            onError(error) {
                console.error("Failed to delete person:", error);
                toast.error(`Failed to delete person: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Person <ObjectName>{person.name}</ObjectName> deleted.
                    </>,
                );

                // Redirect to the personnel list page after deletion. Don't also
                // clear the dialog param / reset the mutation here — the navigation
                // unmounts the dialog, and a competing URL write races the push.
                router.push(
                    route("/orgs/[slug]/admin/personnel", {
                        slug: organization.slug,
                    }),
                );
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Person</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm deletion of personnel record for{" "}
                        <ObjectName>{person.name}</ObjectName>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{
                            idle: "Delete",
                            pending: "Deleting",
                            success: "Deleted",
                        }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                personId: person.id,
                            })
                        }
                    />

                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
