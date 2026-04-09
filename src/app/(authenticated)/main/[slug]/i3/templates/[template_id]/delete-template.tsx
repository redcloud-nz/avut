/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
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
    const organization = useOrganization();
    const router = useRouter();

    const mutation = useMutation(
        trpc.i3.deleteTemplate.mutationOptions({
            onError(error) {
                toast.error(`Failed to delete template: ${error.message}`);
            },
            async onSuccess(_result, _data, _onMutateResult, context) {
                toast.success(
                    <>
                        Template <ObjectName>{template.name}</ObjectName> deleted.
                    </>,
                );
                handleOpenChange(false);

                router.push(route("/main/[slug]/i3/templates", { slug: organization.slug }));

                await context.client.invalidateQueries(
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
