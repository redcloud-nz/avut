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

export function SkillPackageBuilder_ArchiveSkill_Dialog({ skill }: { skill: Skill }) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["archive"] as const));
    const dialogOpen = action === "archive";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "archive" : null, { history: open ? "push" : "replace" });
    }

    const mutation = useMutation(
        trpc.skillPackageBuilder.archiveSkill.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.archiveSkill },
            onError(error) {
                console.error("Failed to archive skill:", error);
                toast.error(`Failed to archive skill: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Skill <ObjectName>{skill.name}</ObjectName> archived.
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
                    <DialogTitle>Archive skill</DialogTitle>
                    <DialogDescription>
                        Archived skills are hidden and no longer assigned in new skill checks. You
                        can restore it later.
                    </DialogDescription>
                </DialogHeader>
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
