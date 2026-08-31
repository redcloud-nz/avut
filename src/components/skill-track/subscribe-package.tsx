/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

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
import { MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";

import { skillsEffects } from "@/client/skills-effects";
import { useOrganization } from "@/hooks/use-organization";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillTrack_SubscribeToPackage_Dialog({
    skillPackage,
    ...props
}: DialogProps & {
    skillPackage: { id: SkillPackageId; name: string };
}) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.skills.subscribeToPackage.mutationOptions({
            meta: { effects: skillsEffects.subscribeToPackage },
            onError(error) {
                console.error("Failed to subscribe to skill package:", error);
                toast.error(`Failed to subscribe to skill package: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Subscribed to <ObjectName>{skillPackage.name}</ObjectName>.
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) {
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <Dialog {...props}>
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
