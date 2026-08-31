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

export function SkillPackageBuilder_ArchivePackage_Dialog({
    skillPackage,
}: {
    skillPackage: SkillPackage;
}) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["archive"] as const));
    const dialogOpen = action === "archive";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "archive" : null, { history: open ? "push" : "replace" });
    }

    const mutation = useMutation(
        trpc.skillPackageBuilder.archivePackage.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.archivePackage },
            onError(error) {
                console.error("Failed to archive package:", error);
                toast.error(`Failed to archive package: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Package <ObjectName>{skillPackage.name}</ObjectName> archived.
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
                    <DialogTitle>Archive package</DialogTitle>
                    <DialogDescription>
                        Archived packages are hidden from the catalogue and cannot be subscribed to.
                        You can restore it later.
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
                            idle: "Archive",
                            pending: "Archiving",
                            success: "Archived",
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
