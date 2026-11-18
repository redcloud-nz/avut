/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { i3BundlesEffects } from "@/client/i3-bundles-effects";
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
import { I3Bundle } from "@/lib/schemas/i3-bundle";
import { trpc } from "@/trpc/client";

export function D4HI3Module_RecoverBundle_Dialog({
    bundle,
    ...props
}: DialogProps & { bundle: I3Bundle }) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.i3Bundles.recoverBundle.mutationOptions({
            meta: { effects: i3BundlesEffects.recoverBundle },
            onError(error) {
                console.error("Failed to recover bundle from rubbish:", error);
                toast.error(`Failed to recover bundle: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Bundle <ObjectName>{bundle.name}</ObjectName> recovered from rubbish.
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Recover Bundle from Rubbish</DialogTitle>
                    <DialogDescription>
                        Recover <ObjectName>{bundle.name}</ObjectName> to Active status.
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
                                bundleId: bundle.id,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
