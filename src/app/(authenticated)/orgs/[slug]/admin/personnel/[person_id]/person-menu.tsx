/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { S2_Button } from "@/components/ui/s2-button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/s2-dialog";
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

    const deleteMutation = useMutation(
        trpc.personnel.deletePerson.mutationOptions({
            onError() {},
            async onSuccess() {},
        }),
    );

    return (
        <>
            {/* Person dropdown menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <S2_Button variant="outline" size="icon">
                        <DropdownMenuTriggerIcon />
                    </S2_Button>
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
                        <DropdownMenuItem>
                            <ObjectIcons.Archive /> Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => {
                                setDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                        >
                            <ObjectIcons.Delete />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete Person dialog*/}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Person</DialogTitle>
                        <DialogDescription>
                            Confirm removal of{" "}
                            <ObjectName>{person.name}</ObjectName>.
                        </DialogDescription>
                    </DialogHeader>
                    <FieldGroup>
                        <Field orientation="horizontal">
                            <S2_Button
                                type="submit"
                                variant="destructive"
                                disabled={deleteMutation.isPending}
                                onClick={() =>
                                    deleteMutation.mutate({
                                        organizationId: organization.id,
                                        personId: person.id,
                                    })
                                }
                            >
                                Delete
                            </S2_Button>
                        </Field>
                    </FieldGroup>
                </DialogContent>
            </Dialog>
        </>
    );
}
