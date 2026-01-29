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
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
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

import { OrganizationData } from "@/lib/schemas/organization";
import { PersonData } from "@/lib/schemas/person";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

interface AdminModule_PersonMenuProps {
    organization: OrganizationData;
    person: PersonData;
}

export function AdminModule_PersonMenu({
    organization,
    person,
}: AdminModule_PersonMenuProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    async function invalidPersonQueries() {
        await Promise.all([
            queryClient.invalidateQueries(
                trpc.personnel.getPerson.queryFilter({
                    organizationId: organization.id,
                    personId: person.id,
                }),
            ),
            queryClient.invalidateQueries(
                trpc.personnel.listPersonnel.queryFilter({
                    organizationId: organization.id,
                }),
            ),
        ]);
    }

    const archiveMutation = useMutation(
        trpc.personnel.archivePerson.mutationOptions({
            async onSettled() {
                await invalidPersonQueries();
            },
        }),
    );
    const deleteMutation = useMutation(
        trpc.personnel.deletePerson.mutationOptions({
            async onSettled() {
                await invalidPersonQueries();
            },
        }),
    );
    const restoreMutation = useMutation(
        trpc.personnel.restorePerson.mutationOptions({
            async onSettled() {
                await invalidPersonQueries();
            },
        }),
    );

    function handleArchive() {
        toast.promise(
            async () =>
                await archiveMutation.mutateAsync({
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

    function handleDelete() {
        toast.promise(
            async () => {
                await deleteMutation.mutateAsync({
                    organizationId: organization.id,
                    personId: person.id,
                });
                router.push(Paths.org(organization.slug).admin.personnel.href);
            },
            {
                loading: "Deleting person...",
                success: "Person deleted.",
                error: (error) => "Failed to delete person: " + error.message,
            },
        );
    }

    function handleRestore() {
        toast.promise(
            async () =>
                await restoreMutation.mutateAsync({
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
                        <DropdownMenuItem asChild>
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
                                    className="text-destructive"
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
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
                            <Button
                                type="button"
                                variant="destructive"
                                disabled={deleteMutation.isPending}
                                onClick={handleDelete}
                            >
                                Delete
                            </Button>
                        </Field>
                    </FieldGroup>
                </DialogContent>
            </Dialog>
        </>
    );
}
