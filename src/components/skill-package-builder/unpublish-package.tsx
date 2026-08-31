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

export function SkillPackageBuilder_UnpublishPackage_Dialog({
    skillPackage,
}: {
    skillPackage: SkillPackage;
}) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["unpublish"] as const),
    );
    const dialogOpen = action === "unpublish";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "unpublish" : null, { history: open ? "push" : "replace" });
    }

    const mutation = useMutation(
        trpc.skillPackageBuilder.unpublishPackage.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.unpublishPackage },
            onError(error) {
                console.error("Failed to unpublish package:", error);
                toast.error(`Failed to unpublish package: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Package <ObjectName>{skillPackage.name}</ObjectName> unpublished.
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
                    <DialogTitle>Unpublish package</DialogTitle>
                    <DialogDescription>
                        Existing subscribers keep their copy; no new organisations can subscribe.
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm">
                    <ObjectName>{skillPackage.name}</ObjectName>
                </p>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Unpublish",
                            pending: "Unpublishing",
                            success: "Unpublished",
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
