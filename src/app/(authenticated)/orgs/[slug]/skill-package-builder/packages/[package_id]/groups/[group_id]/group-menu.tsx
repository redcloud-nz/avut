/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { ComponentProps, useState } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
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
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

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
        trpc.skills.archiveGroup.mutationOptions({
            onError(error) {
                console.error("Failed to archive skill group:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skills.listGroups.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );
    const restoreMutation = useMutation(
        trpc.skills.restoreGroup.mutationOptions({
            onError(error) {
                console.error("Failed to restore skill group:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skills.listGroups.queryFilter({
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
                error: (error) =>
                    "Error archiving skill group." + error.message,
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
                error: (error) =>
                    "Error restoring skill group." + error.message,
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
                    <DropdownMenuLabel>Skill Group</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <Protect
                        orgId={organization.id}
                        permissions={{ skillPackage: ["delete"] }}
                    >
                        <DropdownMenuGroup>
                            {/** Show the archive option if the skill group is active */}
                            {skillGroup.status == "Active" && (
                                <DropdownMenuItem onSelect={handleArchive}>
                                    <ObjectIcons.Archive /> Archive
                                </DropdownMenuItem>
                            )}

                            {/* Show the restore option if the skill group is archived */}
                            {skillGroup.status == "Archived" && (
                                <DropdownMenuItem onSelect={handleRestore}>
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

            <DeleteSkillGroupDialog
                skillGroup={skillGroup}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}

interface DeleteSkillGroupDialogProps extends ComponentProps<typeof Dialog> {
    skillGroup: SkillGroup & { skillPackage: SkillPackage };
}

function DeleteSkillGroupDialog({
    skillGroup,
    ...props
}: DeleteSkillGroupDialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation(
        trpc.skills.deleteGroup.mutationOptions({
            onError(error) {
                console.error("Failed to delete skill group:", error);
            },
            async onSuccess() {
                props.onOpenChange?.(false);

                // Redirect to the package list page after deletion
                router.push(
                    Paths.org(organization.slug).skillPackageBuilder
                        .skillPackages.href,
                );

                await queryClient.invalidateQueries(
                    trpc.skills.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Skill Group</DialogTitle>
                    <DialogDescription>
                        Confirm deletion of skill group{" "}
                        <ObjectName>{skillGroup.name}</ObjectName> from package{" "}
                        <ObjectName>{skillGroup.skillPackage.name}</ObjectName>.
                        This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Field orientation="horizontal">
                        <MutationButton
                            type="button"
                            variant="destructive"
                            onClick={() =>
                                mutation.mutate({
                                    organizationId: organization.id,
                                    skillGroupId: skillGroup.id,
                                })
                            }
                            status={mutation.status}
                            text={{
                                idle: "Delete",
                                pending: "Deleting",
                                success: "Deleted",
                            }}
                        />
                        <Show when={mutation.isIdle}>
                            <Button
                                variant="outline"
                                onClick={() => props.onOpenChange?.(false)}
                            >
                                Cancel
                            </Button>
                        </Show>
                    </Field>
                </FieldGroup>
            </DialogContent>
        </Dialog>
    );
}
