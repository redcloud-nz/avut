/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

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
import { I3Template } from "@/lib/schemas/i3-template";
import { trpc } from "@/trpc/client";

interface I3Module_DeleteTemplate_DialogProps extends AlertDialogProps {
    template: I3Template;
}

export function I3Module_DeleteTemplate_Dialog({
    template,
    ...props
}: I3Module_DeleteTemplate_DialogProps) {
    const logger = useLogger("I3", "DeleteTemplate");
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation(
        trpc.i3.deleteTemplate.mutationOptions({
            onError(error) {
                logger.error("Failed to delete template", error);
                toast.error(`Failed to delete template: ${error.message}`);
            },
            async onSuccess() {
                logger.info(`Template "${template.name}" deleted.`);
                toast.success(`Template "${template.name}" deleted.`);

                await queryClient.invalidateQueries(
                    trpc.i3.listTemplates.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                router.push(route("/orgs/[slug]/i3/templates", { slug: organization.slug }));
            },
        }),
    );

    useEffect(() => {
        // The dialog stays mounted between opens; clear any prior error/success
        // state so a failed delete doesn't leave the button disabled on reopen.
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete I3 Template</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm deletion of template <ObjectName>{template.name}</ObjectName>. This
                        action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                templateId: template.id,
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
