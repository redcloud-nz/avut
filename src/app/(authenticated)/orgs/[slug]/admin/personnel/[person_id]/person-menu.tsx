/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
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
                            <Button
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
                            </Button>
                        </Field>
                    </FieldGroup>
                </DialogContent>
            </Dialog>
        </>
    );
}
