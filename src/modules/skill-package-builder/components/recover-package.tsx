/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { skillPackageBuilderEffects } from "@/client/skill-package-builder-effects";
import { MutationButton } from "@/components/ui/button";
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
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_RecoverPackage_Dialog({
    skillPackage,
    ...props
}: DialogProps & { skillPackage: SkillPackage }) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.skillPackageBuilder.recoverPackage.mutationOptions({
            meta: { effects: skillPackageBuilderEffects.recoverPackage },
            onError(error) {
                console.error("Failed to recover package from rubbish:", error);
                toast.error(`Failed to recover package: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Package <ObjectName>{skillPackage.name}</ObjectName> recovered from rubbish.
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
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Recover Package from Rubbish</DialogTitle>
                    <DialogDescription>
                        Recover <ObjectName>{skillPackage.name}</ObjectName> to Active status. It
                        stays unpublished until you publish it again.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Recover",
                            pending: "Recovering",
                            success: "Recovered",
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
