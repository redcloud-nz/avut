/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

interface SkillPackageBuilder_DeleteSkillGroup_DialogProps extends AlertDialogProps {
    skillGroup: SkillGroup & { skillPackage: SkillPackage };
}

export function SkillPackageBuilder_DeleteSkillGroup_Dialog({
    skillGroup,
    ...props
}: SkillPackageBuilder_DeleteSkillGroup_DialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation(
        trpc.skillPackageBuilder.deleteGroup.mutationOptions({
            onError(error) {
                console.error("Failed to delete skill group:", error);
                toast.error(`Failed to delete skill group: ${error.message}`);
            },
            async onSuccess() {
                toast.success(
                    <>
                        Skill Group <ObjectName>{skillGroup.name}</ObjectName> deleted.
                    </>,
                );
                props.onOpenChange?.(false);

                // Redirect to the package list page after deletion
                router.push(
                    route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                        slug: organization.slug,
                        package_id: skillGroup.skillPackageId,
                    }),
                );

                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listGroups.queryFilter({
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
                    <AlertDialogTitle>Delete Skill Group</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm deletion of skill group <ObjectName>{skillGroup.name}</ObjectName>{" "}
                        from package <ObjectName>{skillGroup.skillPackage.name}</ObjectName>. This
                        action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
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
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
