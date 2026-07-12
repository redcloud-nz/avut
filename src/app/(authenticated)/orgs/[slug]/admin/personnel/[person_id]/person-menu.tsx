/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

import { AdminModule_DeletePerson_Dialog } from "./delete-person";
import { AdminModule_LinkUser_Dialog } from "./link-user";

interface AdminModule_PersonMenuProps {
    person: PersonData;
}

export function AdminModule_PersonMenu({ person }: AdminModule_PersonMenuProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [linkUserDialogOpen, setLinkUserDialogOpen] = useState(false);

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
                toast.error(`Failed to restore person: ${error.message}`);
                console.error("Failed to restore person:", error);
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
                loading: "Archiving person record...",
                success: "Person record archived.",
                error: (error) => "Failed to archive person record: " + error.message,
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
                loading: "Restoring person record...",
                success: "Person record restored.",
                error: (error) => "Failed to restore person record: " + error.message,
            },
        );
    }

    return (
        <>
            {/* Person dropdown menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-50" align="end">
                    <DropdownMenuGroup>
                        <DropdownMenuItem disabled asChild>
                            <Link
                                href={route("/orgs/[slug]/admin/personnel/[person_id]/history", {
                                    slug: organization.slug,
                                    person_id: person.id,
                                })}
                            >
                                <ObjectIcons.History /> History
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />

                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <Protect
                            orgId={organization.id}
                            permissions={{ person: ["update"] }}
                            fallback={
                                <Empty size="sm">
                                    <EmptyHeader>
                                        <EmptyTitle>No Actions Available</EmptyTitle>
                                        <EmptyDescription>
                                            You do not have permission to perform any actions on
                                            this person record.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            }
                        >
                            {person.status == "Active" && (
                                <DropdownMenuItem onClick={handleArchive}>
                                    <ObjectIcons.Archive /> Archive
                                </DropdownMenuItem>
                            )}
                            {person.status != "Archived" && (
                                <DropdownMenuItem
                                    onClick={() => {
                                        setDeleteDialogOpen(true);
                                    }}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <ObjectIcons.Delete />
                                    Delete
                                </DropdownMenuItem>
                            )}
                            {/* {person.status == "Active" && (
                                <DropdownMenuItem onClick={() => setLinkUserDialogOpen(true)}>
                                    <UserIcon /> Link User
                                </DropdownMenuItem>
                            )} */}
                            {person.status != "Active" && (
                                <DropdownMenuItem onClick={handleRestore}>
                                    <ObjectIcons.Restore /> Restore
                                </DropdownMenuItem>
                            )}
                        </Protect>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete Person dialog*/}
            <AdminModule_DeletePerson_Dialog
                person={person}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
            <AdminModule_LinkUser_Dialog
                person={person}
                open={linkUserDialogOpen}
                onOpenChange={setLinkUserDialogOpen}
            />
        </>
    );
}
