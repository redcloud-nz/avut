/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogProps,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { Skill } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";
import { toast } from "sonner";

interface SkillPackageBuilder_DeleteSkill_DialogProps extends AlertDialogProps {
    skill: Skill & { skillGroup: SkillGroup; skillPackage: SkillPackage };
}

export function SkillPackageBuilder_DeleteSkill_Dialog({
    skill,
    ...props
}: SkillPackageBuilder_DeleteSkill_DialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation(
        trpc.skillPackageBuilder.deleteSkill.mutationOptions({
            onError(error) {
                console.error("Failed to delete skill:", error);
                toast.error(`Failed to delete skill: ${error.message}`);
            },
            async onSuccess() {
                toast.success(
                    <>
                        Skill <ObjectName>{skill.name}</ObjectName> deleted.
                    </>,
                );

                props.onOpenChange?.(false);

                // Redirect to the package list page after deletion
                router.push(
                    route(
                        "/main/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]",
                        {
                            slug: organization.slug,
                            package_id: skill.skillPackageId,
                            group_id: skill.skillGroupId,
                        },
                    ),
                );

                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listSkills.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                mutation.reset();
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Skill</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm deletion of skill <ObjectName>{skill.name}</ObjectName> from{" "}
                        <ObjectName>{skill.skillPackage.name}</ObjectName> {" > "}
                        <ObjectName>{skill.skillGroup.name}</ObjectName>. This action cannot be
                        undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
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
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
