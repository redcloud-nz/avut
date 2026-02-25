/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";

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
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";

interface SkillPackageBuilder_Package_MenuProps {
    onArchive: () => void;
    onDelete(): void;
    onRestore(): void;
    skillPackage: SkillPackage;
}

export function SkillPackageBuilder_Package_Menu({
    skillPackage,
    onArchive,
    onDelete,
    onRestore,
}: SkillPackageBuilder_Package_MenuProps) {
    const organization = useOrganization();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

                    <Protect
                        orgId={organization.id}
                        permissions={{ skillPackage: ["update"] }}
                    >
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            {/* Show the archive option if the skill package is active */}
                            {skillPackage.status == "Active" && (
                                <DropdownMenuItem onSelect={onArchive}>
                                    <ObjectIcons.Archive /> Archive
                                </DropdownMenuItem>
                            )}
                            {/* Show the restore option if the skill package is archived */}
                            {skillPackage.status == "Archived" && (
                                <DropdownMenuItem onSelect={onRestore}>
                                    <ObjectIcons.Restore /> Restore
                                </DropdownMenuItem>
                            )}
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
                    </Protect>
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
                                onClick={onDelete}
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
