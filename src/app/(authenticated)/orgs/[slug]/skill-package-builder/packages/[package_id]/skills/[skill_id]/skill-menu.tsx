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
import { getSkillsCollection } from "@/lib/collections/skills";
import { Skill } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";

interface SkillPackageBuilder_Skill_MenuProps {
    skill: Skill & {
        skillGroup: SkillGroup | undefined;
        skillPackage: SkillPackage;
    };
}

export function SkillPackageBuilder_Skill_Menu({
    skill,
}: SkillPackageBuilder_Skill_MenuProps) {
    const organization = useOrganization();
    const router = useRouter();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    function handleDelete() {
        toast.promise(
            async () => {
                router.push(
                    Paths.org(
                        organization.slug,
                    ).skillPackageBuilder.skillPackage(skill.skillPackage.id)
                        .index.href,
                );

                // Wait for the navigation to complete before performing the delete operation.
                await new Promise((resolve) => setTimeout(resolve, 200));

                const collection = getSkillsCollection(organization.id);
                const tx = collection.delete(skill.id);

                await tx.isPersisted.promise;
            },
            {
                loading: "Deleting skill...",
                success: "Skill deleted",
                error: (error) => `Failed to delete skill: ${error.message}`,
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
                    <DropdownMenuLabel>Skill</DropdownMenuLabel>

                    <DropdownMenuGroup>
                        <Protect
                            orgId={organization.id}
                            permissions={{ skillPackage: ["delete"] }}
                        >
                            <DropdownMenuItem asChild>
                                <Link
                                    to={
                                        Paths.org(organization.slug)
                                            .skillPackageBuilder.skillPackage(
                                                skill.skillPackageId,
                                            )
                                            .skill(skill.id).update
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
                        </Protect>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Skill </DialogTitle>
                        <DialogDescription>
                            Confirm deletion of skill{" "}
                            <ObjectName>{skill.name}</ObjectName> from package{" "}
                            <ObjectName>{skill.skillPackage.name}</ObjectName>.
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
