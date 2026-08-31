/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ObjectName } from "@/components/ui/typography";

import { skillPackageBuilderEffects } from "@/client/skill-package-builder-effects";
import { useOrganization } from "@/hooks/use-organization";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_PublishPackage_Dialog({
    skillPackage,
}: {
    skillPackage: SkillPackage;
}) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["publish"] as const));
    const dialogOpen = action === "publish";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "publish" : null, { history: open ? "push" : "replace" });
    }

    const mutation = useMutation(
        trpc.skillPackageBuilder.publishPackage.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.publishPackage },
            onError(error) {
                console.error("Failed to publish package:", error);
                toast.error(`Failed to publish package: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Package <ObjectName>{skillPackage.name}</ObjectName> published.
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

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Publish package</DialogTitle>
                    <DialogDescription>
                        Publish package <ObjectName>{skillPackage.name}</ObjectName>. Publishing
                        makes this package available for other organisations to subscribe to.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Publish",
                            pending: "Publishing",
                            success: "Published",
                        }}
                        onClick={() =>
                            mutation.mutate({
                                skillPackageId: skillPackage.id,
                                organizationId: organization.id,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
