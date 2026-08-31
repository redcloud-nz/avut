/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

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

import { skillsEffects } from "@/client/skills-effects";
import { useOrganization } from "@/hooks/use-organization";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillTrack_SubscribeToPackage_Dialog({
    skillPackage,
}: {
    skillPackage: { id: SkillPackageId; name: string };
}) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["subscribe"] as const),
    );
    const dialogOpen = action === "subscribe";

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
                handleDialogOpenChange(false);
            },
        }),
    );

    useEffect(() => {
        if (dialogOpen) {
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "subscribe" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
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
