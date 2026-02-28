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
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_Package_Menu({
    skillPackage,
}: {
    skillPackage: SkillPackage;
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const archiveMutation = useMutation(
        trpc.skills.archivePackage.mutationOptions({
            onError(error) {
                console.error("Failed to archive skill package:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skills.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );
    const restoreMutation = useMutation(
        trpc.skills.restorePackage.mutationOptions({
            onError(error) {
                console.error("Failed to restore skill package:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skills.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    function handleArchive() {
        toast.promise(
            archiveMutation.mutateAsync({
                skillPackageId: skillPackage.id,
                organizationId: organization.id,
            }),
            {
                loading: "Archiving skill package...",
                success: "Skill package archived.",
                error: (error) =>
                    "Error archiving skill package." + error.message,
            },
        );
    }

    function handleRestore() {
        toast.promise(
            restoreMutation.mutateAsync({
                skillPackageId: skillPackage.id,
                organizationId: organization.id,
            }),
            {
                loading: "Restoring skill package...",
                success: "Skill package restored.",
                error: (error) =>
                    "Error restoring skill package." + error.message,
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
                                <DropdownMenuItem
                                    onClick={handleArchive}
                                    disabled={archiveMutation.isPending}
                                >
                                    <ObjectIcons.Archive /> Archive
                                </DropdownMenuItem>
                            )}
                            {/* Show the restore option if the skill package is archived */}
                            {skillPackage.status == "Archived" && (
                                <DropdownMenuItem
                                    onClick={handleRestore}
                                    disabled={restoreMutation.isPending}
                                >
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
            <DeleteSkillPackageDialog
                skillPackage={skillPackage}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}

interface DeleteSkillPackageDialogProps extends ComponentProps<typeof Dialog> {
    skillPackage: SkillPackage;
}

function DeleteSkillPackageDialog({
    skillPackage,
    ...props
}: DeleteSkillPackageDialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation(
        trpc.skills.deletePackage.mutationOptions({
            onError(error) {
                console.error("Failed to delete skill package:", error);
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
                    <DialogTitle>Delete Skill Package</DialogTitle>
                    <DialogDescription>
                        Confirm deletion of skill package{" "}
                        <ObjectName>{skillPackage.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Field orientation="horizontal">
                        <MutationButton
                            type="button"
                            variant="destructive"
                            status={mutation.status}
                            text={{
                                idle: "Delete",
                                pending: "Deleting",
                                success: "Deleted",
                            }}
                            onClick={() =>
                                mutation.mutate({
                                    organizationId: organization.id,
                                    skillPackageId: skillPackage.id,
                                })
                            }
                        />
                        <Show when={!mutation.isPending}>
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
