/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { ComponentProps } from "react";
import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";

import { S2_Button } from "@/components/ui/s2-button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/s2-dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { ObjectName } from "@/components/ui/typography";

import { useToast } from "@/hooks/use-toast";
import { OrganizationData } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

type DeleteTeamMembership_DialogProps = Omit<
    ComponentProps<typeof Dialog>,
    "children"
> & {
    onDelete: () => void;
    organization: OrganizationData;
    personId: PersonId;
    teamId: TeamId;
};

export function DeleteTeamMembershipDialog({
    onDelete,
    organization,
    personId,
    teamId,
    ...props
}: DeleteTeamMembership_DialogProps) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const {
        data: { person, team },
    } = useSuspenseQuery(
        trpc.teamMemberships.getTeamMembership.queryOptions({
            orgId: organization.orgId,
            personId,
            teamId,
        }),
    );

    const mutation = useMutation(
        trpc.teamMemberships.deleteTeamMembership.mutationOptions({
            onMutate() {
                props.onOpenChange?.(false);
            },
            onError(error) {
                toast({
                    title: "Error deleting team membership",
                    description: error.message,
                    variant: "destructive",
                });
            },
            onSuccess() {
                toast({
                    title: "Team membership deleted",
                    description: (
                        <>
                            <ObjectName>{person.name}</ObjectName> has been
                            removed from <ObjectName>{team.name}</ObjectName>.
                        </>
                    ),
                });

                queryClient.invalidateQueries(
                    trpc.teamMemberships.getTeamMemberships.queryFilter({
                        orgId: organization.orgId,
                        personId,
                    }),
                );
                queryClient.invalidateQueries(
                    trpc.teamMemberships.getTeamMemberships.queryFilter({
                        orgId: organization.orgId,
                        teamId,
                    }),
                );

                onDelete();
            },
        }),
    );

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Team Membership</DialogTitle>
                    <DialogDescription>
                        Confirm removal of{" "}
                        <ObjectName>{person.name}</ObjectName> from team{" "}
                        <ObjectName>{team.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Field orientation="horizontal">
                        <S2_Button
                            type="submit"
                            variant="destructive"
                            disabled={mutation.isPending}
                            onClick={() =>
                                mutation.mutate({
                                    orgId: organization.orgId,
                                    personId,
                                    teamId,
                                })
                            }
                        >
                            {mutation.isPending ? (
                                <>
                                    <Spinner /> Deleting...
                                </>
                            ) : (
                                "Delete"
                            )}
                        </S2_Button>
                        <DialogClose asChild>
                            <S2_Button variant="outline">Cancel</S2_Button>
                        </DialogClose>
                    </Field>
                </FieldGroup>
            </DialogContent>
        </Dialog>
    );
}
