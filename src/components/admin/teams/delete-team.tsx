/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useMutation, useQuery } from "@tanstack/react-query";

import { teamsEffects } from "@/client/teams-effects";
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
import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_DeleteTeam_Dialog({
    team,
    ...props
}: AlertDialogProps & {
    team: TeamData;
}) {
    const organization = useOrganization();
    const router = useRouter();

    const impact = useQuery(
        trpc.teams.getTeamDeleteImpact.queryOptions(
            { organizationId: organization.id, teamId: team.id },
            { enabled: props.open },
        ),
    );

    const mutation = useMutation(
        trpc.teams.deleteTeam.mutationOptions({
            meta: { effects: teamsEffects.deleteTeam, navigates: true },
            onError(error) {
                console.error("Failed to delete team:", error);
                toast.error("Failed to delete team: " + error.message);
            },
            onSuccess() {
                toast.success(
                    <>
                        Team <ObjectName>{team.name}</ObjectName> deleted.
                    </>,
                );

                router.push(route("/orgs/[slug]/admin/teams", { slug: organization.slug }));
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Team</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm deletion of team <ObjectName>{team.name}</ObjectName>.
                        {impact.data && impact.data.memberCount > 0 && (
                            <>
                                {" "}
                                This team has {impact.data.memberCount} active member
                                {impact.data.memberCount === 1 ? "" : "s"} — deleting hides the team
                                from active views but does not remove those memberships.
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                teamId: team.id,
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
