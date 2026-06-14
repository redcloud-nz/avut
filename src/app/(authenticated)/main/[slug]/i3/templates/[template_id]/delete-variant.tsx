/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

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
import { I3Template } from "@/lib/schemas/i3-template";
import { I3TemplateVariant } from "@/lib/schemas/i3-template-variant";
import { trpc } from "@/trpc/client";

interface I3Module_DeleteVariant_DialogProps extends AlertDialogProps {
    template: I3Template;
    variant: I3TemplateVariant;
}

export function I3Module_DeleteVariant_Dialog({
    template,
    variant,
    ...props
}: I3Module_DeleteVariant_DialogProps) {
    const logger = useLogger("I3", "DeleteVariant");
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.i3.deleteTemplateVariant.mutationOptions({
            onError(error) {
                logger.error("Failed to delete template variant", error);
                toast.error(`Failed to delete template variant: ${error.message}`);
            },
            async onSuccess() {
                logger.info(
                    `Template variant "${variant.name}" deleted from template "${template.name}".`,
                );
                toast.success(
                    `Template variant "${variant.name}" deleted from template "${template.name}".`,
                );
                handleOpenChange(false);

                await queryClient.invalidateQueries(
                    trpc.i3.listTemplates.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            mutation.reset();
        }
        props.onOpenChange?.(open);
    }

    return (
        <AlertDialog {...props} onOpenChange={handleOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete I3 Template Variant</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm deletion of template variant <ObjectName>{variant.name}</ObjectName>{" "}
                        from template <ObjectName>{template.name}</ObjectName>. This action cannot
                        be undone.
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
                                variantId: variant.id,
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
