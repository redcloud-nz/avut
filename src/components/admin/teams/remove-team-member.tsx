/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

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

import { teamsEffects } from "@/client/teams-effects";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonRef } from "@/lib/schemas/person";
import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_RemoveTeamMember_Dialog({
    organizationId,
    team,
    person,
    ...props
}: {
    organizationId: OrganizationId;
    team: TeamData;
    person: PersonRef | null;
} & ComponentProps<typeof AlertDialog>) {
    const mutation = useMutation(
        trpc.teams.deleteTeamMembership.mutationOptions({
            meta: { effects: teamsEffects.deleteTeamMembership },
            onError(error) {
                console.error("Failed to remove team member:", error);
                toast.error(`Failed to remove team member: ${error.message}`);
            },
            onSuccess() {
                toast.success("Team member removed");

                handleOpenChange(false);
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
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove Person from Team</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm removal of <ObjectName>{person?.name}</ObjectName> from{" "}
                        <ObjectName>{team.name}</ObjectName>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{
                            idle: "Remove",
                            pending: "Removing",
                            success: "Removed",
                        }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId,
                                teamId: team.id,
                                personId: person!.id,
                            })
                        }
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
