/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuGroupLabel,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup } from "@/components/ui/field";
import { Link } from "@/components/ui/link";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { PersonData } from "@/lib/schemas/person";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

interface AdminModule_PersonMenuProps {
    person: PersonData;
}

export function AdminModule_PersonMenu({
    person,
}: AdminModule_PersonMenuProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const archiveMutation = useMutation(
        trpc.personnel.archivePerson.mutationOptions({
            onError(error) {
                toast.error(`Failed to archive person: ${error.message}`);
                console.error("Failed to archive person:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.personnel.listPersonnel.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );
    const restoreMutation = useMutation(
        trpc.personnel.restorePerson.mutationOptions({
            onError(error) {
                toast.error(`Failed to archive person: ${error.message}`);
                console.error("Failed to archive person:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.personnel.listPersonnel.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    function handleArchive() {
        toast.promise(
            archiveMutation.mutateAsync({
                organizationId: organization.id,
                personId: person.id,
            }),
            {
                loading: "Archiving person...",
                success: "Person archived.",
                error: (error) => "Failed to archive person: " + error.message,
            },
        );
    }

    function handleRestore() {
        toast.promise(
            restoreMutation.mutateAsync({
                organizationId: organization.id,
                personId: person.id,
            }),
            {
                loading: "Restoring person...",
                success: "Person restored.",
                error: (error) => "Failed to restore person: " + error.message,
            },
        );
    }

    return (
        <>
            {/* Person dropdown menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="end">
                    <DropdownMenuLabel>Person</DropdownMenuLabel>
                    <DropdownMenuGroup>
                        <DropdownMenuItem disabled asChild>
                            <Link
                                to={
                                    Paths.org(organization.slug).admin.person(
                                        person.id,
                                    ).history
                                }
                            >
                                <ObjectIcons.History /> History
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />

                    <DropdownMenuGroup>
                        <DropdownMenuGroupLabel>Actions</DropdownMenuGroupLabel>
                        {person.status == "Active" && (
                            <Protect
                                orgId={organization.id}
                                permissions={{ person: ["archive"] }}
                            >
                                <DropdownMenuItem onSelect={handleArchive}>
                                    <ObjectIcons.Archive /> Archive
                                </DropdownMenuItem>
                            </Protect>
                        )}
                        {person.status != "Archived" && (
                            <Protect
                                orgId={organization.id}
                                permissions={{ person: ["delete"] }}
                            >
                                <DropdownMenuItem
                                    onSelect={() => {
                                        setDeleteDialogOpen(true);
                                    }}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <ObjectIcons.Delete />
                                    Delete
                                </DropdownMenuItem>
                            </Protect>
                        )}
                        {person.status != "Active" && (
                            <Protect
                                orgId={organization.id}
                                permissions={{ person: ["restore"] }}
                            >
                                <DropdownMenuItem onSelect={handleRestore}>
                                    <ObjectIcons.Restore /> Restore
                                </DropdownMenuItem>
                            </Protect>
                        )}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete Person dialog*/}
            <AdminModule_DeletePerson_Dialog
                person={person}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}

function AdminModule_DeletePerson_Dialog({
    person,
    ...props
}: DialogProps & { person: PersonData }) {
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
                await queryClient.invalidateQueries(
                    trpc.personnel.listPersonnel.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                props.onOpenChange?.(false);

                // Redirect to the personnel list page after deletion
                router.push(Paths.org(organization.slug).admin.personnel.href);
            },
        }),
    );

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Person</DialogTitle>
                    <DialogDescription>
                        Confirm deletion of personnel record for{" "}
                        <ObjectName>{person.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Field orientation="horizontal">
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
                        <Show when={mutation.isIdle}>
                            <Button
                                variant="outline"
                                onClick={() => props.onOpenChange?.(false)}
                            >
                                Cancel
                            </Button>
                        </Show>
                    </Field>
                </FieldGroup>
            </DialogContent>
        </Dialog>
    );
}
