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

import { useOrganization } from "@/hooks/use-organization";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";

import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_DeleteSkillGroup_Dialog } from "./delete-group";

interface SkillPackageBuilder_Group_MenuProps {
    skillGroup: SkillGroup & { skillPackage: SkillPackage };
}

export function SkillPackageBuilder_Group_Menu({
    skillGroup,
}: SkillPackageBuilder_Group_MenuProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const archiveMutation = useMutation(
        trpc.skillPackageBuilder.archiveGroup.mutationOptions({
            onError(error) {
                console.error("Failed to archive skill group:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listGroups.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );
    const restoreMutation = useMutation(
        trpc.skillPackageBuilder.restoreGroup.mutationOptions({
            onError(error) {
                console.error("Failed to restore skill group:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listGroups.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    function handleArchive() {
        toast.promise(
            archiveMutation.mutateAsync({
                skillGroupId: skillGroup.id,
                organizationId: organization.id,
            }),
            {
                loading: "Archiving skill group...",
                success: "Skill group archived.",
                error: (error) => "Error archiving skill group." + error.message,
            },
        );
    }

    function handleRestore() {
        toast.promise(
            restoreMutation.mutateAsync({
                skillGroupId: skillGroup.id,
                organizationId: organization.id,
            }),
            {
                loading: "Restoring skill group...",
                success: "Skill group restored.",
                error: (error) => "Error restoring skill group." + error.message,
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
                            permissions={{ skillPackageBuilder: ["delete"] }}
                            render={(allowed) => (
                                <>
                                    {/** Show the archive option if the skill group is active */}
                                    {skillGroup.status == "Active" && (
                                        <DropdownMenuItem
                                            onSelect={handleArchive}
                                            disabled={!allowed || archiveMutation.isPending}
                                        >
                                            <ObjectIcons.Archive /> Archive
                                        </DropdownMenuItem>
                                    )}

                                    {/* Show the restore option if the skill group is archived */}
                                    {skillGroup.status == "Archived" && (
                                        <DropdownMenuItem
                                            onSelect={handleRestore}
                                            disabled={!allowed || restoreMutation.isPending}
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
                                    onSelect={() => setDeleteDialogOpen(true)}
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

            <SkillPackageBuilder_DeleteSkillGroup_Dialog
                skillGroup={skillGroup}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}
