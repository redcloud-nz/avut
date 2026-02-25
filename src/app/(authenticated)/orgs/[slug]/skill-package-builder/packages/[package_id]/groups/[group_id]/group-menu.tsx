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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup } from "@/components/ui/field";
import { Link } from "@/components/ui/link";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";

interface SkillPackageBuilder_Group_MenuProps {
    skillGroup: SkillGroup & { skillPackage: SkillPackage };
    onArchive(): void;
    onDelete(): void;
    onRestore(): void;
}

export function SkillPackageBuilder_Group_Menu({
    onArchive,
    onDelete,
    onRestore,
    skillGroup,
}: SkillPackageBuilder_Group_MenuProps) {
    const organization = useOrganization();
    const router = useRouter();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    function handleDelete() {
        toast.promise(
            async () => {
                router.push(
                    Paths.org(
                        organization.slug,
                    ).skillPackageBuilder.skillPackage(
                        skillGroup.skillPackageId,
                    ).index.href,
                );

                // Wait for the navigation to complete before performing the delete operation.
                await new Promise((resolve) => setTimeout(resolve, 200));

                const collection = getSkillGroupsCollection(organization.id);
                const tx = collection.delete(skillGroup.id);

                await tx.isPersisted.promise;
            },
            {
                loading: "Deleting skill group...",
                success: "Skill group deleted",
                error: (error) =>
                    `Failed to delete skill group: ${error.message}`,
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
                    <DropdownMenuLabel>Skill Group</DropdownMenuLabel>

                    <Protect
                        orgId={organization.id}
                        permissions={{ skillPackage: ["delete"] }}
                    >
                        <DropdownMenuGroup>
                            {/** Show the archive option if the skill group is active */}
                            {skillGroup.skillPackage.status == "Active" && (
                                <DropdownMenuItem onSelect={onArchive}>
                                    <ObjectIcons.Archive /> Archive
                                </DropdownMenuItem>
                            )}

                            {/* Show the restore option if the skill group is archived */}
                            {skillGroup.skillPackage.status == "Archived" && (
                                <DropdownMenuItem onSelect={onRestore}>
                                    <ObjectIcons.Restore /> Restore
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild>
                                <Link
                                    to={
                                        Paths.org(organization.slug)
                                            .skillPackageBuilder.skillPackage(
                                                skillGroup.skillPackageId,
                                            )
                                            .group(skillGroup.id).update
                                    }
                                >
                                    <ObjectIcons.Edit /> Edit
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={() => setDeleteDialogOpen(true)}
                                className="text-destructive focus:text-destructive"
                            >
                                <ObjectIcons.Delete /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </Protect>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Skill Group</DialogTitle>
                        <DialogDescription>
                            Confirm deletion of skill group{" "}
                            <ObjectName>{skillGroup.name}</ObjectName> from
                            package{" "}
                            <ObjectName>
                                {skillGroup.skillPackage.name}
                            </ObjectName>
                            .
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
