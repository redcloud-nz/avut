/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";

import { skillsEffects } from "@/client/skills-effects";
import { useOrganization } from "@/hooks/use-organization";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillTrack_UnsubscribeFromPackage_Dialog({
    skillPackage,
}: {
    skillPackage: { id: SkillPackageId; name: string };
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.skills.unsubscribeFromPackage.mutationOptions({
            meta: { effects: skillsEffects.unsubscribeFromPackage },
            onError(error) {
                console.error("Failed to unsubscribe from skill package:", error);
                toast.error(`Failed to unsubscribe from skill package: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Unsubscribed from <ObjectName>{skillPackage.name}</ObjectName>.
                    </>,
                );
                queryClient.setQueryData(
                    trpc.skills.getPackage.queryKey({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                    (old) =>
                        old
                            ? {
                                  ...old,
                                  subscription: null,
                                  subscriptionCount: old.subscriptionCount - 1,
                              }
                            : old,
                );
            },
        }),
    );

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline">Unsubscribe</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Unsubscribe from Package</AlertDialogTitle>
                    <AlertDialogDescription>
                        You will be unsubscribed from <ObjectName>{skillPackage.name}</ObjectName>.
                        Skills from this package will no longer be available to your organization.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{
                            idle: "Unsubscribe",
                            pending: "Unsubscribing...",
                            success: "Unsubscribed",
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
