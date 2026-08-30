/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import {
    AlertDialog,
    AlertDialogProps,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";

import { skillPackageBuilderEffects } from "@/client/skill-package-builder-effects";
import { useOrganization } from "@/hooks/use-organization";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_DeletePackage_Dialog({
    skillPackage,
    ...props
}: AlertDialogProps & { skillPackage: SkillPackage }) {
    const organization = useOrganization();
    const router = useRouter();

    const mutation = useMutation(
        trpc.skillPackageBuilder.deletePackage.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.deletePackage },
            onError(error) {
                console.error("Failed to delete skill package:", error);
                toast.error(`Failed to delete skill package: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Skill Package <ObjectName>{skillPackage.name}</ObjectName> deleted.
                    </>,
                );

                // Redirect to the package list page after deletion
                router.push(
                    route("/orgs/[slug]/skill-package-builder", { slug: organization.slug }),
                );
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Skill Package</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm deletion of skill package{" "}
                        <ObjectName>{skillPackage.name}</ObjectName>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
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
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
