/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import { Skill } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_DeleteSkill_Dialog } from "./delete-skill";
import { SkillPackageBuilder_MoveSkill_Dialog } from "./move-skill";

interface SkillPackageBuilder_Skill_MenuProps {
    skill: Skill & {
        skillGroup: SkillGroup;
        skillPackage: SkillPackage;
    };
}

export function SkillPackageBuilder_Skill_Menu({
    skill,
}: SkillPackageBuilder_Skill_MenuProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [moveDialogOpen, setMoveDialogOpen] = useState(false);

    const archiveMutation = useMutation(
        trpc.skillPackageBuilder.archiveSkill.mutationOptions({
            onError(error) {
                console.error("Failed to archive skill:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listSkills.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );
    const restoreMutation = useMutation(
        trpc.skillPackageBuilder.restoreSkill.mutationOptions({
            onError(error) {
                console.error("Failed to restore skill:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listSkills.queryFilter({
                        organizationId: organization.id,
                    }),
                );
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

                    <Protect
                        orgId={organization.id}
                        permissions={{ skillPackageBuilder: ["update"] }}
                        fallback={
                            <Empty size="sm">
                                <EmptyHeader>
                                    <EmptyTitle>
                                        No Actions Available
                                    </EmptyTitle>
                                    <EmptyDescription>
                                        You do not have permission to perform
                                        any actions on this skill.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        }
                    >
                        <DropdownMenuGroup>
                            {/* Show the archive option if the skill package is active */}
                            {skill.status == "Active" && (
                                <DropdownMenuItem onClick={handleArchive}>
                                    <ObjectIcons.Archive /> Archive
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={() => setMoveDialogOpen(true)}
                            >
                                <ObjectIcons.Move /> Move
                            </DropdownMenuItem>
                            {/* Show the restore option if the skill package is archived */}
                            {skill.status == "Archived" && (
                                <DropdownMenuItem onClick={handleRestore}>
                                    <ObjectIcons.Restore /> Restore
                                </DropdownMenuItem>
                            )}
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
                                onClick={() => setDeleteDialogOpen(true)}
                                className="text-destructive focus:text-destructive"
                            >
                                <ObjectIcons.Delete /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </Protect>
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
