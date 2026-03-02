/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import {
    useMutation,
    useQueries,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogProps,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { Skill, SkillId } from "@/lib/schemas/skill";
import { SkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

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
        trpc.skills.archiveSkill.mutationOptions({
            onError(error) {
                console.error("Failed to archive skill:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skills.listSkills.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );
    const restoreMutation = useMutation(
        trpc.skills.restoreSkill.mutationOptions({
            onError(error) {
                console.error("Failed to restore skill:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skills.listSkills.queryFilter({
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
                        permissions={{ skillPackage: ["update"] }}
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

            <DeleteSkillDialog
                skill={skill}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
            <MoveSkillDialog
                skill={skill}
                open={moveDialogOpen}
                onOpenChange={setMoveDialogOpen}
            />
        </>
    );
}

interface DeleteSkillDialogProps extends AlertDialogProps {
    skill: Skill & { skillGroup: SkillGroup; skillPackage: SkillPackage };
}

function DeleteSkillDialog({ skill, ...props }: DeleteSkillDialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation(
        trpc.skills.deleteSkill.mutationOptions({
            onError(error) {
                console.error("Failed to delete skill:", error);
            },
            async onSuccess() {
                props.onOpenChange?.(false);

                // Redirect to the package list page after deletion
                router.push(
                    Paths.org(organization.slug)
                        .skillPackageBuilder.skillPackage(skill.skillPackageId)
                        .group(skill.skillGroupId).href,
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
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Skill</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm deletion of skill{" "}
                        <ObjectName>{skill.name}</ObjectName> from package{" "}
                        <ObjectName>{skill.skillPackage.name}</ObjectName>. This
                        action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <Show when={mutation.isIdle}>
                        <Button
                            variant="outline"
                            onClick={() => props.onOpenChange?.(false)}
                        >
                            Cancel
                        </Button>
                        <MutationButton
                            type="button"
                            variant="destructive"
                            onClick={() =>
                                mutation.mutate({
                                    organizationId: organization.id,
                                    skillId: skill.id,
                                })
                            }
                            status={mutation.status}
                            text={{
                                idle: "Delete",
                                pending: "Deleting",
                                success: "Deleted",
                            }}
                        />
                    </Show>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function MoveSkillDialog({
    skill,
    ...props
}: { skill: Skill } & AlertDialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data: skillPackages = [], isSuccess: skillPackagesReady } =
        useQuery(
            trpc.skills.listPackages.queryOptions({
                organizationId: organization.id,
            }),
        );

    const { data: skillGroups = [], isSuccess: skillGroupsReady } = useQueries({
        queries: skillPackages.map((skillPackage) =>
            trpc.skills.listGroups.queryOptions({
                organizationId: organization.id,
                skillPackageId: skillPackage.id,
            }),
        ),
        combine: (results) => {
            return {
                data: results.flatMap((result) => result.data ?? []),
                isSuccess: results.every((result) => result.isSuccess),
                isLoading: results.some((result) => result.isLoading),
                isPending: results.some((result) => result.isPending),
                isError: results.some((result) => result.isError),
            };
        },
    });

    const originPackage = skillPackages.find(
        (pkg) => pkg.id === skill.skillPackageId,
    );
    const originGroup = skillGroups.find(
        (group) => group.id === skill.skillGroupId,
    );

    const [destinationPackageId, setDestinationPackageId] = useState<string>(
        skill.skillPackageId,
    );
    const [destinationGroupId, setDestinationGroupId] =
        useState<SkillGroupId | null>(null);

    const mutation = useMutation(
        trpc.skills.moveSkill.mutationOptions({
            onMutate(data) {
                const parsed = z
                    .object({
                        skillId: SkillId.schema,
                        destinationPackageId: SkillPackageId.schema,
                        destinationGroupId: SkillGroupId.schema,
                    })
                    .parse(data);

                const queryKey = trpc.skills.listSkills.queryKey({
                    organizationId: organization.id,
                    skillPackageId: destinationPackageId,
                });

                const previousDestinationSkills =
                    queryClient.getQueryData(queryKey) || [];

                // Optimistically add the skill to the destination package's skill list
                queryClient.setQueryData(queryKey, [
                    ...previousDestinationSkills,
                    {
                        ...skill,
                        skillGroupId: parsed.destinationGroupId,
                        skillPackageId: parsed.destinationPackageId,
                    },
                ]);

                return { previousDestinationSkills };
            },
            onError(error, data, context) {
                if (context?.previousDestinationSkills) {
                    queryClient.setQueryData(
                        trpc.skills.listSkills.queryKey({
                            organizationId: organization.id,
                            skillPackageId: data.destinationPackageId,
                        }),
                        context.previousDestinationSkills,
                    );
                }

                console.error("Failed to move skill:", error);
                toast.error("Error moving skill: " + error.message);
            },
            async onSuccess({ updated }) {
                const destinationPackage = skillPackages.find(
                    (pkg) => pkg.id === updated.skillPackageId,
                );
                const destinationGroup = skillGroups.find(
                    (group) => group.id === updated.skillGroupId,
                );
                toast.success(
                    <>
                        Skill moved from{" "}
                        <ObjectName>{originPackage?.name}</ObjectName>
                        {" > "}
                        <ObjectName>{originGroup?.name}</ObjectName> to{" "}
                        <ObjectName>{destinationPackage?.name}</ObjectName>
                        {" > "}
                        <ObjectName>{destinationGroup?.name}</ObjectName>.
                    </>,
                );

                props.onOpenChange?.(false);

                router.replace(
                    Paths.org(organization.slug)
                        .skillPackageBuilder.skillPackage(
                            updated.skillPackageId,
                        )
                        .skill(updated.id).href,
                );
            },
            async onSettled() {
                await Promise.all([
                    // Destination package skills list
                    queryClient.invalidateQueries(
                        trpc.skills.listSkills.queryFilter({
                            organizationId: organization.id,
                            skillPackageId: destinationPackageId,
                        }),
                    ),
                    // Origin package skills list
                    queryClient.invalidateQueries(
                        trpc.skills.listSkills.queryFilter({
                            organizationId: organization.id,
                            skillPackageId: skill.skillPackageId,
                        }),
                    ),
                ]);
            },
        }),
    );

    useEffect(() => {
        if (!props.open) {
            // Reset state when dialog is closed.
            setDestinationPackageId(skill.skillPackageId);
            setDestinationGroupId(null);
            mutation.reset();
        }
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Move Skill</DialogTitle>
                    <DialogDescription>
                        Move skill <ObjectName>{skill.name}</ObjectName> to
                        another group.
                    </DialogDescription>
                </DialogHeader>

                <Show
                    when={skillPackagesReady && skillGroupsReady}
                    fallback={
                        <div className="flex flex-col gap-2">
                            <Skeleton className="w-full h-14" />
                            <Skeleton className="w-full h-14" />
                            <Skeleton className="w-full h-14" />
                            <Skeleton className="w-full h-14" />
                        </div>
                    }
                >
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Origin Package</FieldLabel>
                            <FieldValue value={originPackage?.name!} />
                        </Field>
                        <Field>
                            <FieldLabel>Origin Group</FieldLabel>
                            <FieldValue value={originGroup?.name!} />
                        </Field>
                        <Field>
                            <FieldLabel>Destination Package</FieldLabel>
                            <Select
                                value={destinationPackageId}
                                onValueChange={(value) => {
                                    setDestinationPackageId(value);
                                    setDestinationGroupId(null);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {skillPackages.map((skillPackage) => (
                                        <SelectItem
                                            key={skillPackage.id}
                                            value={skillPackage.id}
                                        >
                                            {skillPackage.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field>
                            <FieldLabel>Destination Group</FieldLabel>
                            <Select
                                value={destinationGroupId ?? ""}
                                onValueChange={(value) =>
                                    setDestinationGroupId(value as SkillGroupId)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a group" />
                                </SelectTrigger>
                                <SelectContent>
                                    {skillGroups
                                        .filter(
                                            (group) =>
                                                group.skillPackageId ===
                                                destinationPackageId,
                                        )
                                        .map((group) => (
                                            <SelectItem
                                                key={group.id}
                                                value={group.id}
                                                disabled={
                                                    group.id ==
                                                    skill.skillGroupId
                                                }
                                            >
                                                {group.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    </FieldGroup>
                    <DialogFooter>
                        <MutationButton
                            onClick={() =>
                                mutation.mutateAsync({
                                    organizationId: organization.id,
                                    skillId: skill.id,
                                    destinationPackageId,
                                    destinationGroupId: destinationGroupId!,
                                })
                            }
                            status={mutation.status}
                            disabled={!destinationGroupId}
                            text={{
                                idle: "Move",
                                pending: "Moving",
                                success: "Moved",
                            }}
                        />
                        <DialogCloseButton variant="outline">
                            Cancel
                        </DialogCloseButton>
                    </DialogFooter>
                </Show>
            </DialogContent>
        </Dialog>
    );
}
