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
import { D4hPpeTemplate } from "@/lib/schemas/d4h-ppe-template";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

interface D4hPPEModule_DeleteTemplate_DialogProps extends AlertDialogProps {
    template: D4hPpeTemplate;
}

export function D4hPPEModule_DeleteTemplate_Dialog({
    template,
    ...props
}: D4hPPEModule_DeleteTemplate_DialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation(
        trpc.d4hPpe.deleteTemplate.mutationOptions({
            onError(error) {
                toast.error(`Failed to delete template: ${error.message}`);
            },
            async onSuccess() {
                toast.success(
                    <>
                        Template <ObjectName>{template.name}</ObjectName>{" "}
                        deleted.
                    </>,
                );
                props.onOpenChange?.(false);

                router.push(Paths.org(organization.slug).d4HPpe.templates.href);

                await queryClient.invalidateQueries(
                    trpc.d4hPpe.listTemplates.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                mutation.reset();
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete PPE Template</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm deletion of template{" "}
                        <ObjectName>{template.name}</ObjectName>. This action
                        cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                d4hPpeTemplateId: template.id,
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
