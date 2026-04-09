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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

import { useOrganization } from "@/hooks/use-organization";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_DeletePackage_Dialog } from "./delete-package";

export function SkillPackageBuilder_Package_Menu({ skillPackage }: { skillPackage: SkillPackage }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const archiveMutation = useMutation(
        trpc.skillPackageBuilder.archivePackage.mutationOptions({
            onError(error) {
                console.error("Failed to archive skill package:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    const publishMutation = useMutation(
        trpc.skillPackageBuilder.publishPackage.mutationOptions({
            onError(error) {
                console.error("Failed to publish skill package:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    const restoreMutation = useMutation(
        trpc.skillPackageBuilder.restorePackage.mutationOptions({
            onError(error) {
                console.error("Failed to restore skill package:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    const unpublishMutation = useMutation(
        trpc.skillPackageBuilder.unpublishPackage.mutationOptions({
            onError(error) {
                console.error("Failed to unpublish skill package:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listPackages.queryFilter({
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
                error: (error) => "Error archiving skill package." + error.message,
            },
        );
    }

    function handlePublish() {
        toast.promise(
            publishMutation.mutateAsync({
                skillPackageId: skillPackage.id,
                organizationId: organization.id,
            }),
            {
                loading: "Publishing skill package...",
                success: "Skill package published.",
                error: (error) => "Error publishing skill package." + error.message,
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
                error: (error) => "Error restoring skill package." + error.message,
            },
        );
    }

    function handleUnpublish() {
        toast.promise(
            unpublishMutation.mutateAsync({
                skillPackageId: skillPackage.id,
                organizationId: organization.id,
            }),
            {
                loading: "Unpublishing skill package...",
                success: "Skill package unpublished.",
                error: (error) => "Error unpublishing skill package." + error.message,
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
                    <DropdownMenuGroup>
                        <DropdownMenuItem asChild disabled>
                            <Link
                                href={route(
                                    "/main/[slug]/skill-package-builder/packages/[package_id]/history",
                                    { slug: organization.slug, package_id: skillPackage.id },
                                )}
                            >
                                <ObjectIcons.History /> History
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <Protect
                        orgId={organization.id}
                        permissions={{ skillPackageBuilder: ["update"] }}
                    >
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            {/* Show the archive option if the skill package is active */}
                            {skillPackage.status == "Active" && (
                                <DropdownMenuItem
                                    onClick={handleArchive}
                                    disabled={archiveMutation.isPending}
                                >
                                    <ObjectIcons.Archive /> Archive
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem asChild>
                                <Link
                                    href={route(
                                        "/main/[slug]/skill-package-builder/packages/[package_id]/--update",
                                        { slug: organization.slug, package_id: skillPackage.id },
                                    )}
                                >
                                    <ObjectIcons.Edit /> Edit
                                </Link>
                            </DropdownMenuItem>

                            <Protect
                                orgId={organization.id}
                                permissions={{
                                    skillPackageBuilder: ["delete"],
                                }}
                            >
                                <DropdownMenuItem
                                    onSelect={() => setDeleteDialogOpen(true)}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <ObjectIcons.Delete /> Delete
                                </DropdownMenuItem>
                            </Protect>
                            {/* Show the publish option if the skill package is not published */}
                            {!skillPackage.published && (
                                <DropdownMenuItem
                                    onClick={handlePublish}
                                    disabled={publishMutation.isPending}
                                >
                                    <ObjectIcons.Publish /> Publish
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
                            {/* Show the unpublish option if the skill package is published */}
                            {skillPackage.published && (
                                <DropdownMenuItem
                                    onClick={handleUnpublish}
                                    disabled={unpublishMutation.isPending}
                                >
                                    <ObjectIcons.Unpublish /> Unpublish
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuGroup>
                    </Protect>
                </DropdownMenuContent>
            </DropdownMenu>
            <SkillPackageBuilder_DeletePackage_Dialog
                skillPackage={skillPackage}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}
