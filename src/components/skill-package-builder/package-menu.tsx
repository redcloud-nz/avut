/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
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
import { ObjectName } from "@/components/ui/typography";

import { skillPackageBuilderInvalidations } from "@/client/skill-package-builder-invalidations";
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
            meta: { invalidates: skillPackageBuilderInvalidations.archivePackage },
            onError(error) {
                console.error("Failed to archive skill package:", error);
            },
            onSuccess({ updated }) {
                queryClient.setQueryData(
                    trpc.skillPackageBuilder.getPackage.queryKey({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                    updated,
                );
            },
        }),
    );

    const publishMutation = useMutation(
        trpc.skillPackageBuilder.publishPackage.mutationOptions({
            meta: { invalidates: skillPackageBuilderInvalidations.publishPackage },
            onError(error) {
                console.error("Failed to publish skill package:", error);
            },
            onSuccess({ published }) {
                queryClient.setQueryData(
                    trpc.skillPackageBuilder.getPackage.queryKey({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                    published,
                );
            },
        }),
    );

    const restoreMutation = useMutation(
        trpc.skillPackageBuilder.restorePackage.mutationOptions({
            meta: { invalidates: skillPackageBuilderInvalidations.restorePackage },
            onError(error) {
                console.error("Failed to restore skill package:", error);
            },
            onSuccess({ updated }) {
                queryClient.setQueryData(
                    trpc.skillPackageBuilder.getPackage.queryKey({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                    updated,
                );
            },
        }),
    );

    const unpublishMutation = useMutation(
        trpc.skillPackageBuilder.unpublishPackage.mutationOptions({
            meta: { invalidates: skillPackageBuilderInvalidations.unpublishPackage },
            onError(error) {
                console.error("Failed to unpublish skill package:", error);
            },
            onSuccess({ unpublished }) {
                queryClient.setQueryData(
                    trpc.skillPackageBuilder.getPackage.queryKey({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                    unpublished,
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
                success: (
                    <>
                        Skill package <ObjectName>{skillPackage.name}</ObjectName> archived.
                    </>
                ),
                error: (error) => (
                    <>
                        Error archiving skill package <ObjectName>{skillPackage.name}</ObjectName>:{" "}
                        {error.message}
                    </>
                ),
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
                success: (
                    <>
                        Skill package <ObjectName>{skillPackage.name}</ObjectName> published.
                    </>
                ),
                error: (error) => (
                    <>
                        Error publishing skill package <ObjectName>{skillPackage.name}</ObjectName>:{" "}
                        {error.message}
                    </>
                ),
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
                success: (
                    <>
                        Skill package <ObjectName>{skillPackage.name}</ObjectName> restored.
                    </>
                ),
                error: (error) => (
                    <>
                        Error restoring skill package <ObjectName>{skillPackage.name}</ObjectName>:{" "}
                        {error.message}
                    </>
                ),
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
                success: (
                    <>
                        Skill package <ObjectName>{skillPackage.name}</ObjectName> unpublished.
                    </>
                ),
                error: (error) => (
                    <>
                        Error unpublishing skill package{" "}
                        <ObjectName>{skillPackage.name}</ObjectName>: {error.message}
                    </>
                ),
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
                                    "/orgs/[slug]/skill-package-builder/packages/[package_id]/history",
                                    { slug: organization.slug, package_id: skillPackage.id },
                                )}
                            >
                                <ObjectIcons.History /> History
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <Protect
                            permissions={{ skillPackageBuilder: ["update"] }}
                            render={(allowed) => (
                                <>
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    {/* Show the archive option if the skill package is active */}
                                    {skillPackage.status == "Active" && (
                                        <DropdownMenuItem
                                            onClick={handleArchive}
                                            disabled={!allowed || archiveMutation.isPending}
                                        >
                                            <ObjectIcons.Archive /> Archive
                                        </DropdownMenuItem>
                                    )}
                                    {/* Show the publish option if the skill package is not published */}
                                    {!skillPackage.published && (
                                        <DropdownMenuItem
                                            onClick={handlePublish}
                                            disabled={!allowed || publishMutation.isPending}
                                        >
                                            <ObjectIcons.Publish /> Publish
                                        </DropdownMenuItem>
                                    )}
                                    {/* Show the restore option if the skill package is archived */}
                                    {skillPackage.status == "Archived" && (
                                        <DropdownMenuItem
                                            onClick={handleRestore}
                                            disabled={!allowed || restoreMutation.isPending}
                                        >
                                            <ObjectIcons.Restore /> Restore
                                        </DropdownMenuItem>
                                    )}
                                    {/* Show the unpublish option if the skill package is published */}
                                    {skillPackage.published && (
                                        <DropdownMenuItem
                                            onClick={handleUnpublish}
                                            disabled={!allowed || unpublishMutation.isPending}
                                        >
                                            <ObjectIcons.Unpublish /> Unpublish
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
                        />
                        <Protect
                            permissions={{
                                skillPackageBuilder: ["delete"],
                            }}
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
            <SkillPackageBuilder_DeletePackage_Dialog
                skillPackage={skillPackage}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}
