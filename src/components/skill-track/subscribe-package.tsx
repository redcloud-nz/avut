/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button, MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";

import { skillsInvalidations } from "@/client/skills-invalidations";
import { useOrganization } from "@/hooks/use-organization";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillTrack_SubscribeToPackage_Dialog({
    skillPackage,
}: {
    skillPackage: { id: SkillPackageId; name: string };
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [dialogOpen, setDialogOpen] = useState(false);

    const mutation = useMutation(
        trpc.skills.subscribeToPackage.mutationOptions({
            meta: { invalidates: skillsInvalidations.subscribeToPackage },
            onError(error) {
                console.error("Failed to subscribe to skill package:", error);
                toast.error(`Failed to subscribe to skill package: ${error.message}`);
            },
            onSuccess({ created }) {
                toast.success(
                    <>
                        Subscribed to <ObjectName>{skillPackage.name}</ObjectName>.
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
                                  subscription: created,
                                  subscriptionCount: old.subscriptionCount + 1,
                              }
                            : old,
                );
                handleOpenChange(false);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) mutation.reset();
        setDialogOpen(open);
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">Subscribe</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Subscribe to Package</DialogTitle>
                    <DialogDescription>
                        You will be subscribed to <ObjectName>{skillPackage.name}</ObjectName>.
                        Skills from this package will become available to your organization.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Subscribe",
                            pending: "Subscribing...",
                            success: "Subscribed",
                        }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                skillPackageId: skillPackage.id,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
