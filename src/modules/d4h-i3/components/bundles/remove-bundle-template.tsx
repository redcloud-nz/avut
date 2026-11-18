/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { i3BundlesEffects } from "@/client/i3-bundles-effects";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogProps,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { I3Bundle, I3BundleLine } from "@/lib/schemas/i3-bundle";
import { trpc } from "@/trpc/client";

/** Confirms removing one template from a bundle. Host-driven: the lines card owns the params. */
export function D4HI3Module_RemoveBundleTemplate_Dialog({
    bundle,
    line,
    ...props
}: AlertDialogProps & { bundle: I3Bundle; line: I3BundleLine }) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.i3Bundles.removeTemplate.mutationOptions({
            meta: { effects: i3BundlesEffects.removeTemplate },
            onError(error) {
                console.error("Failed to remove template from bundle:", error);
                toast.error(`Failed to remove template: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Template <ObjectName>{line.template.name}</ObjectName> removed from{" "}
                        <ObjectName>{bundle.name}</ObjectName>.
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state when opening or when the target row changes under an open dialog
    }, [props.open, line.template.id]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove Template</AlertDialogTitle>
                    <AlertDialogDescription>
                        Remove template <ObjectName>{line.template.name}</ObjectName> from bundle{" "}
                        <ObjectName>{bundle.name}</ObjectName>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                bundleId: bundle.id,
                                templateId: line.template.id,
                            })
                        }
                        status={mutation.status}
                        text={{
                            idle: "Remove",
                            pending: "Removing",
                            success: "Removed",
                        }}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
