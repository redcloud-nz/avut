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

import { SkillPackage } from "@/lib/schemas/skill-package";
import { OrganizationData } from "@/lib/schemas/organization";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

interface SkillPackageAuthor_PackageMenuProps {
    organization: OrganizationData;
    skillPackage: SkillPackage;
}

export function SkillPackageAuthor_PackageMenu({
    organization,
    skillPackage,
}: SkillPackageAuthor_PackageMenuProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    async function invalidateSkillPackageQueries() {
        await Promise.all([
            queryClient.invalidateQueries(
                trpc.skills.getPackage.queryFilter({
                    organizationId: organization.id,
                    skillPackageId: skillPackage.id,
                }),
            ),
            queryClient.invalidateQueries(
                trpc.skills.listPackages.queryFilter({
                    organizationId: organization.id,
                }),
            ),
        ]);
    }

    const deleteMutation = useMutation(
        trpc.skills.deletePackage.mutationOptions({
            async onSettled() {
                await invalidateSkillPackageQueries();
            },
        }),
    );

    function handleDelete() {
        toast.promise(
            async () => {
                await deleteMutation.mutateAsync({
                    organizationId: organization.id,
                    skillPackageId: skillPackage.id,
                });
                router.push(
                    Paths.org(organization.slug).skillPackageAuthor
                        .skillPackages.href,
                );
            },
            {
                loading: "Deleting skill package...",
                success: "Skill package deleted.",
                error: (error) =>
                    "Error deleting skill package." + error.message,
            },
        );
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40" align="end">
                    <DropdownMenuLabel>Skill Package</DropdownMenuLabel>
                    <DropdownMenuGroup>
                        <DropdownMenuItem asChild disabled>
                            <Link
                                to={
                                    Paths.org(
                                        organization.slug,
                                    ).skillPackageAuthor.skillPackage(
                                        skillPackage.id,
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
                        <Protect
                            orgId={organization.id}
                            permissions={{ skillPackage: ["delete"] }}
                        >
                            <DropdownMenuItem
                                onSelect={() => setDeleteDialogOpen(true)}
                                className="text-destructive focus:text-destructive"
                            >
                                <ObjectIcons.Delete /> Delete
                            </DropdownMenuItem>
                        </Protect>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Skill Package</DialogTitle>
                        <DialogDescription>
                            Confirm deletion of{" "}
                            <ObjectName>{skillPackage.name}</ObjectName>.
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
