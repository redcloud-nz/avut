/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";
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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
    skillPackageBuilderInvalidations,
    skillPackageBuilderWrites,
} from "@/client/skill-package-builder-invalidations";
import { useOrganization } from "@/hooks/use-organization";
import { Skill } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_DeleteSkill_Dialog } from "./delete-skill";
import { SkillPackageBuilder_MoveSkill_Dialog } from "./move-skill";

interface SkillPackageBuilder_Skill_MenuProps {
    skill: Skill & {
        skillGroup: SkillGroup;
        skillPackage: SkillPackage;
    };
}

export function SkillPackageBuilder_Skill_Menu({ skill }: SkillPackageBuilder_Skill_MenuProps) {
    const organization = useOrganization();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [moveDialogOpen, setMoveDialogOpen] = useState(false);

    const archiveMutation = useMutation(
        trpc.skillPackageBuilder.archiveSkill.mutationOptions({
            meta: {
                invalidates: skillPackageBuilderInvalidations.archiveSkill,
                writes: skillPackageBuilderWrites.archiveSkill,
            },
            onError(error) {
                console.error("Failed to archive skill:", error);
            },
        }),
    );
    const restoreMutation = useMutation(
        trpc.skillPackageBuilder.restoreSkill.mutationOptions({
            meta: {
                invalidates: skillPackageBuilderInvalidations.restoreSkill,
                writes: skillPackageBuilderWrites.restoreSkill,
            },
            onError(error) {
                console.error("Failed to restore skill:", error);
            },
        }),
    );

    function handleArchive() {
        toast.promise(
            archiveMutation.mutateAsync({
                skillId: skill.id,
                organizationId: organization.id,
            }),
            {
                loading: "Archiving skill...",
                success: "Skill archived.",
                error: (error) => "Error archiving skill." + error.message,
            },
        );
    }

    function handleRestore() {
        toast.promise(
            restoreMutation.mutateAsync({
                skillId: skill.id,
                organizationId: organization.id,
            }),
            {
                loading: "Restoring skill...",
                success: "Skill restored.",
                error: (error) => "Error restoring skill." + error.message,
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
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>

                    <DropdownMenuGroup>
                        <Protect
                            permissions={{ skillPackageBuilder: ["update"] }}
                            render={(allowed) => (
                                <>
                                    {/* Show the archive option if the skill package is active */}
                                    {skill.status == "Active" && (
                                        <DropdownMenuItem
                                            onClick={handleArchive}
                                            disabled={!allowed}
                                        >
                                            <ObjectIcons.Archive /> Archive
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                        onClick={() => setMoveDialogOpen(true)}
                                        disabled={!allowed}
                                    >
                                        <ObjectIcons.Move /> Move
                                    </DropdownMenuItem>
                                    {/* Show the restore option if the skill package is archived */}
                                    {skill.status == "Archived" && (
                                        <DropdownMenuItem
                                            onClick={handleRestore}
                                            disabled={!allowed}
                                        >
                                            <ObjectIcons.Restore /> Restore
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                        />
                        <Protect
                            permissions={{ skillPackageBuilder: ["delete"] }}
                            render={(allowed) => (
                                <DropdownMenuItem
                                    onClick={() => setDeleteDialogOpen(true)}
                                    className="text-destructive focus:text-destructive"
                                    disabled={!allowed}
                                >
                                    <ObjectIcons.Delete /> Delete
                                </DropdownMenuItem>
                            )}
                        />
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            <SkillPackageBuilder_DeleteSkill_Dialog
                skill={skill}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
            <SkillPackageBuilder_MoveSkill_Dialog
                skill={skill}
                open={moveDialogOpen}
                onOpenChange={setMoveDialogOpen}
            />
        </>
    );
}
