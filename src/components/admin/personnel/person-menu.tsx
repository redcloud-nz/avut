/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

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

import { personnelEffects } from "@/client/personnel-effects";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

import { AdminModule_DeletePerson_Dialog } from "./delete-person";

interface AdminModule_PersonMenuProps {
    person: PersonData;
}

export function AdminModule_PersonMenu({ person }: AdminModule_PersonMenuProps) {
    const organization = useOrganization();

    const [dialog, setDialog] = useQueryState("dialog", parseAsStringLiteral(["delete"] as const));

    const archiveMutation = useMutation(
        trpc.personnel.archivePerson.mutationOptions({
            meta: { effects: personnelEffects.archivePerson },
            onError(error) {
                toast.error(`Failed to archive person: ${error.message}`);
                console.error("Failed to archive person:", error);
            },
        }),
    );
    const restoreMutation = useMutation(
        trpc.personnel.restorePerson.mutationOptions({
            meta: { effects: personnelEffects.restorePerson },
            onError(error) {
                toast.error(`Failed to restore person: ${error.message}`);
                console.error("Failed to restore person:", error);
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
                        {person.status == "Active" && (
                            <Protect
                                permissions={{ person: ["update"] }}
                                render={(allowed) => (
                                    <DropdownMenuItem onClick={handleArchive} disabled={!allowed}>
                                        <ObjectIcons.Archive /> Archive
                                    </DropdownMenuItem>
                                )}
                            />
                        )}
                        {person.status != "Active" && (
                            <Protect
                                permissions={{ person: ["update"] }}
                                render={(allowed) => (
                                    <DropdownMenuItem onClick={handleRestore} disabled={!allowed}>
                                        <ObjectIcons.Restore /> Restore
                                    </DropdownMenuItem>
                                )}
                            />
                        )}
                        {person.status != "Archived" && (
                            <Protect
                                permissions={{ person: ["delete"] }}
                                render={(allowed) => (
                                    <DropdownMenuItem
                                        onClick={() => setDialog("delete", { history: "push" })}
                                        disabled={!allowed}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <ObjectIcons.Delete />
                                        Delete
                                    </DropdownMenuItem>
                                )}
                            />
                        )}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete Person dialog*/}
            <AdminModule_DeletePerson_Dialog
                person={person}
                open={dialog === "delete"}
                onOpenChange={(open) =>
                    setDialog(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
