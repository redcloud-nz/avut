/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup } from "@/components/ui/field";
import { Link } from "@/components/ui/link";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";

interface SkillPackageBuilder_Package_MenuProps {
    skillPackage: SkillPackage;
}

export function SkillPackageBuilder_Package_Menu({
    skillPackage,
}: SkillPackageBuilder_Package_MenuProps) {
    const organization = useOrganization();
    const router = useRouter();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    function handleDelete() {
        toast.promise(
            async () => {
                router.push(
                    Paths.org(organization.slug).skillPackageBuilder
                        .skillPackages.href,
                );

                // Wait for the navigation to complete before performing the delete operation.
                await new Promise((resolve) => setTimeout(resolve, 500));

                const collection = getSkillPackagesCollection(organization.id);

                const tx = collection.delete(skillPackage.id);

                await tx.isPersisted.promise;
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
                    <Button variant="ghost" size="icon">
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
                                    ).skillPackageBuilder.skillPackage(
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
                        <Protect
                            orgId={organization.id}
                            permissions={{ skillPackage: ["update"] }}
                        >
                            <DropdownMenuItem asChild>
                                <Link
                                    to={
                                        Paths.org(
                                            organization.slug,
                                        ).skillPackageBuilder.skillPackage(
                                            skillPackage.id,
                                        ).update
                                    }
                                >
                                    <ObjectIcons.Edit /> Edit
                                </Link>
                            </DropdownMenuItem>
                        </Protect>
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
                            Confirm deletion of skill package{" "}
                            <ObjectName>{skillPackage.name}</ObjectName>.
                        </DialogDescription>
                    </DialogHeader>
                    <FieldGroup>
                        <Field orientation="horizontal">
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                            >
                                Delete
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setDeleteDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                        </Field>
                    </FieldGroup>
                </DialogContent>
            </Dialog>
        </>
    );
}
