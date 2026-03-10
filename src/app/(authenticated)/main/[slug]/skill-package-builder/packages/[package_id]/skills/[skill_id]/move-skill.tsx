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

import { Show } from "@/components/show";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
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
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_MoveSkill_Dialog({
    skill,
    ...props
}: { skill: Skill } & DialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data: skillPackages = [], isSuccess: skillPackagesReady } =
        useQuery(
            trpc.skillPackageBuilder.listPackages.queryOptions({
                organizationId: organization.id,
            }),
        );

    const { data: skillGroups = [], isSuccess: skillGroupsReady } = useQueries({
        queries: skillPackages.map((skillPackage) =>
            trpc.skillPackageBuilder.listGroups.queryOptions({
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
        trpc.skillPackageBuilder.moveSkill.mutationOptions({
            onMutate(data) {
                const parsed = z
                    .object({
                        skillId: SkillId.schema,
                        destinationPackageId: SkillPackageId.schema,
                        destinationGroupId: SkillGroupId.schema,
                    })
                    .parse(data);

                const queryKey = trpc.skillPackageBuilder.listSkills.queryKey({
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
                        trpc.skillPackageBuilder.listSkills.queryKey({
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
                    Paths.main(organization.slug)
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
                        trpc.skillPackageBuilder.listSkills.queryFilter({
                            organizationId: organization.id,
                            skillPackageId: destinationPackageId,
                        }),
                    ),
                    // Origin package skills list
                    queryClient.invalidateQueries(
                        trpc.skillPackageBuilder.listSkills.queryFilter({
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
