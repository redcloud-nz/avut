/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { i3Effects } from "@/client/i3-effects";
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
import { I3Template } from "@/lib/schemas/i3-template";
import { trpc } from "@/trpc/client";

export function I3Module_RecoverTemplate_Dialog({
    template,
    ...props
}: DialogProps & { template: I3Template }) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.i3.recoverTemplate.mutationOptions({
            meta: { effects: i3Effects.recoverTemplate },
            onError(error) {
                console.error("Failed to recover template from rubbish:", error);
                toast.error(`Failed to recover template: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Template <ObjectName>{template.name}</ObjectName> recovered from rubbish.
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
                    <DialogTitle>Recover Template from Rubbish</DialogTitle>
                    <DialogDescription>
                        Recover <ObjectName>{template.name}</ObjectName> to Active status.
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
                                templateId: template.id,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
