/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { ComponentProps } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
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
}: ComponentProps<typeof AlertDialog> & { session: SkillCheckSession }) {
    const organization = useOrganization();
    const router = useRouter();

    const mutation = useMutation(
        trpc.skills.deleteSession.mutationOptions({
            meta: { effects: skillsEffects.deleteSession },
            onError(error) {
                console.error("Failed to delete session:", error);
                toast.error("Failed to delete session: " + error.message);
            },
            onSuccess() {
                toast.success(
                    <>
                        Session <ObjectName>{session.name}</ObjectName> deleted.
                    </>,
                );

                // Redirect to the sessions list page after deletion. Don't also
                // clear the dialog param / reset the mutation here — the navigation
                // unmounts the dialog, and a competing URL write races the push.
                router.push(
                    route("/orgs/[slug]/skill-track/sessions", { slug: organization.slug }),
                );
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
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
