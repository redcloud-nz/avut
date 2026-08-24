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

import { skillsEffects } from "@/client/skills-effects";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillsModule_DeleteSession_Dialog({
    session,
    ...props
}: AlertDialogProps & { session: SkillCheckSession }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation(
        trpc.skills.deleteSession.mutationOptions({
            meta: { effects: skillsEffects.deleteSession },
            onError(error) {
                console.error("Failed to delete session:", error);
                toast.error("Failed to delete session: " + error.message);
            },
            async onSuccess() {
                toast.success(
                    <>
                        Session <ObjectName>{session.name}</ObjectName> deleted.
                    </>,
                );
                props.onOpenChange?.(false);

                router.push(
                    route("/orgs/[slug]/skill-track/sessions", { slug: organization.slug }),
                );

                queryClient.removeQueries(
                    trpc.skills.getSession.queryFilter({
                        skillCheckSessionId: session.id,
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
                    <AlertDialogTitle>Delete Session</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete the session{" "}
                        <ObjectName>{session.name}</ObjectName>? This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                skillCheckSessionId: session.id,
                            })
                        }
                        status={mutation.status}
                        text={{
                            idle: "Delete",
                            pending: "Deleting...",
                            success: "Deleted",
                        }}
                        variant="destructive"
                    />
                    <AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
