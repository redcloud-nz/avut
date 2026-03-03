/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogProps,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { PersonData } from "@/lib/schemas/person";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export function AdminModule_DeletePerson_Dialog({
    person,
    ...props
}: AlertDialogProps & { person: PersonData }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation(
        trpc.personnel.deletePerson.mutationOptions({
            onError(error) {
                console.error("Failed to delete person:", error);
                toast.error(`Failed to delete person: ${error.message}`);
            },
            async onSuccess() {
                toast.success(
                    <>
                        Person <ObjectName>{person.name}</ObjectName> deleted.
                    </>,
                );
                props.onOpenChange?.(false);

                // Redirect to the personnel list page after deletion
                router.push(Paths.org(organization.slug).admin.personnel.href);

                await queryClient.invalidateQueries(
                    trpc.personnel.listPersonnel.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                mutation.reset();
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent>
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
