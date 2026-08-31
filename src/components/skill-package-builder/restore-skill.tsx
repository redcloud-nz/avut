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
import { Skill } from "@/lib/schemas/skill";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_RestoreSkill_Dialog({ skill }: { skill: Skill }) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["restore"] as const));
    const dialogOpen = action === "restore";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "restore" : null, { history: open ? "push" : "replace" });
    }

    const mutation = useMutation(
        trpc.skillPackageBuilder.restoreSkill.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.restoreSkill },
            onError(error) {
                console.error("Failed to restore skill:", error);
                toast.error(`Failed to restore skill: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Skill <ObjectName>{skill.name}</ObjectName> restored.
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
                    <DialogTitle>Restore skill</DialogTitle>
                    <DialogDescription>The skill returns to Active.</DialogDescription>
                </DialogHeader>
                <p className="text-sm">
                    <ObjectName>{skill.name}</ObjectName>
                </p>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Restore",
                            pending: "Restoring",
                            success: "Restored",
                        }}
                        onClick={() =>
                            mutation.mutate({
                                skillId: skill.id,
                                organizationId: organization.id,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
