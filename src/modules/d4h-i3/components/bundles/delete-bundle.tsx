/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
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
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { I3Bundle } from "@/lib/schemas/i3-bundle";
import { trpc } from "@/trpc/client";

export function D4HI3Module_DeleteBundle_Dialog({
    bundle,
    ...props
}: AlertDialogProps & { bundle: I3Bundle }) {
    const logger = useLogger("I3", "DeleteBundle");
    const organization = useOrganization();
    const router = useRouter();

    const mutation = useMutation(
        trpc.i3Bundles.deleteBundle.mutationOptions({
            meta: { effects: i3BundlesEffects.deleteBundle, navigates: true },
            onError(error) {
                logger.error("Failed to delete bundle", error);
                toast.error(`Failed to delete bundle: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Bundle <ObjectName>{bundle.name}</ObjectName> deleted.
                    </>,
                );
                router.push(route("/orgs/[slug]/d4h-i3/bundles", { slug: organization.slug }));
            },
        }),
    );

    useEffect(() => {
        // The dialog stays mounted between opens; clear any prior error/success state so a
        // failed delete doesn't leave the button disabled on reopen.
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete I3 Bundle</AlertDialogTitle>
                    <AlertDialogDescription>
                        Move bundle <ObjectName>{bundle.name}</ObjectName> to the Rubbish bin. You
                        can recover it from there.
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
                            })
                        }
                        status={mutation.status}
                        text={{
                            idle: "Delete",
                            pending: "Deleting",
                            success: "Deleted",
                        }}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
