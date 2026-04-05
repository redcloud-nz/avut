/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { RefreshCwIcon } from "lucide-react";
import { ComponentProps, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { TeamData, TeamRef } from "@/lib/schemas/team";
import { TeamMembershipData, TeamMembershipId } from "@/lib/schemas/team-membership";
import { trpc } from "@/trpc/client";

interface AdminModule_TeamPersonnel_SectionProps {
    team: TeamData;
}

export function AdminModule_TeamPersonnel_Section({
    team,
}: AdminModule_TeamPersonnel_SectionProps) {
    const organization = useOrganization();

    const teamMembersQuery = useQuery(
        trpc.teams.listTeamMemberships.queryOptions({
            organizationId: organization.id,
            teamId: team.id,
        }),
    );

    const [newMemberDialogOpen, setNewMemberDialogOpen] = useState(false);
    const [syncD4HDialogOpen, setSyncD4HDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<PersonRef | null>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Team Personnel</CardTitle>
                <CardAction>
                    <Protect orgId={organization.id} permissions={{ team: ["update"] }}>
                        {team.type == "General" && (
                            <Button variant="ghost" onClick={() => setNewMemberDialogOpen(true)}>
                                <ObjectIcons.Create />
                            </Button>
                        )}
                        {team.type == "D4HDefined" && (
                            <Button variant="ghost" onClick={() => setSyncD4HDialogOpen(true)}>
                                <RefreshCwIcon />
                            </Button>
                        )}
                    </Protect>
                </CardAction>
            </CardHeader>
            <CardContent>
                {teamMembersQuery.isLoading ? (
                    <>
                        <Hermes.Header>
                            <Skeleton className="h-8 w-50" />
                            <Skeleton className="h-8 w-20" />
                        </Hermes.Header>
                        <Skeleton className="h-20 w-full" />
                    </>
                ) : (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeadCell>Name</TableHeadCell>
                                    <TableCell className="w-9"></TableCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(teamMembersQuery.data ?? [])
                                    .sort((a, b) => a.person.name.localeCompare(b.person.name))
                                    .map(({ person, ...teamMembership }) => (
                                        <TableRow key={teamMembership.personId}>
                                            <TableCell>{person.name}</TableCell>
                                            <TableCell className="w-9 p-0">
                                                <Protect
                                                    orgId={organization.id}
                                                    permissions={{ team: ["update"] }}
                                                >
                                                    {team.type == "General" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setDeleteTarget(person)}
                                                        >
                                                            <ObjectIcons.Delete />
                                                        </Button>
                                                    )}
                                                </Protect>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </>
                )}
            </CardContent>

            {/* Add Person Dialog */}
            <AddTeamMemberDialog
                organizationId={organization.id}
                team={team}
                open={newMemberDialogOpen}
                onOpenChange={setNewMemberDialogOpen}
            />

            {/* Remove Person Dialog */}
            <RemoveTeamMemberDialog
                organizationId={organization.id}
                team={team}
                person={deleteTarget}
                open={deleteTarget !== null}
                onOpenChange={() => setDeleteTarget(null)}
            />

            <SyncD4HTeamDialog
                team={team}
                open={syncD4HDialogOpen}
                onOpenChange={setSyncD4HDialogOpen}
            />
        </Card>
    );
}

function AddTeamMemberDialog({
    organizationId,
    team,
    ...props
}: {
    organizationId: OrganizationId;
    team: TeamData;
} & ComponentProps<typeof Dialog>) {
    const personnelQuery = useQuery(
        trpc.personnel.listPersonnel.queryOptions({
            organizationId,
        }),
    );
    const personnel = (personnelQuery.data ?? []).sort((a, b) => a.name.localeCompare(b.name));

    const teamMembershipsQuery = useQuery(
        trpc.teams.listTeamMemberships.queryOptions({
            organizationId,
            teamId: team.id,
        }),
    );
    const teamMemberships = teamMembershipsQuery.data ?? [];

    const assignedIds = teamMemberships.map((tm) => tm.personId);

    const form = useForm({
        resolver: zodResolver(
            z.object({
                personId: PersonId.schema,
            }),
        ),
    });

    const mutation = useMutation(
        trpc.teams.createTeamMembership.mutationOptions({
            async onMutate(data, context) {
                const person = personnel.find((p) => p.id === data.personId);
                if (!person) {
                    throw new Error("Selected person not found");
                }

                const queryKey = trpc.teams.listTeamMemberships.queryKey({
                    organizationId,
                    teamId: team.id,
                });

                await context.client.cancelQueries({ queryKey });

                const optimisticMembership = {
                    id: TeamMembershipId.create(),
                    organizationId,
                    teamId: team.id,
                    personId: person.id,
                    tags: data.create.tags,
                    properties: data.create.properties,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    person: {
                        id: person.id,
                        name: person.name,
                    },
                    team: {
                        id: team.id,
                        name: team.name,
                    },
                } satisfies TeamMembershipData & { person: PersonRef; team: TeamRef };

                const previousData =
                    context.client.getQueryData<
                        (TeamMembershipData & { person: PersonRef; team: TeamRef })[]
                    >(queryKey);

                context.client.setQueryData(queryKey, (old = []) => [...old, optimisticMembership]);

                return { previousData };
            },
            onError(error, _variables, onMutateResult, context) {
                if (onMutateResult?.previousData) {
                    const queryKey = trpc.teams.listTeamMemberships.queryKey({
                        organizationId,
                        teamId: team.id,
                    });
                    context.client.setQueryData(queryKey, onMutateResult.previousData);
                }

                console.error("Failed to add team member:", error);
                toast.error(`Failed to add team member: ${error.message}`);
            },
            onSuccess({ created }, _variables, _onMutateResult, context) {
                toast.success(`${created.person.name} added to team ${created.team.name}`);

                handleOpenChange(false);
            },
            onSettled(_result, _error, data, _onMutateResult, context) {
                context.client.invalidateQueries(
                    trpc.teams.listTeamMemberships.queryFilter({
                        organizationId,
                        teamId: data.teamId,
                    }),
                );
                context.client.invalidateQueries(
                    trpc.teams.listTeamMemberships.queryFilter({
                        organizationId,
                        personId: data.personId,
                    }),
                );
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            form.reset();
            mutation.reset();
        }
        props.onOpenChange?.(open);
    }

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Person to Team</DialogTitle>
                    <DialogDescription>
                        Select a person to add to <ObjectName>{team.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="add-person-to-team-form"
                    onSubmit={form.handleSubmit((formData) =>
                        mutation.mutate({
                            organizationId,
                            teamId: team.id,
                            personId: formData.personId,
                            create: {
                                tags: [],
                                properties: {},
                            },
                        }),
                    )}
                >
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="personId"
                            render={({ field, fieldState }) => (
                                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                    <FieldLabel>Person</FieldLabel>
                                    <Select
                                        value={field.value ?? ""}
                                        onValueChange={(value) =>
                                            field.onChange((value as PersonId) || null)
                                        }
                                    >
                                        <SelectTrigger aria-invalid={fieldState.invalid}>
                                            <SelectValue placeholder="Select a person" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {personnel.map((person) => (
                                                <SelectItem
                                                    key={person.id}
                                                    value={person.id}
                                                    disabled={assignedIds.includes(person.id)}
                                                >
                                                    {person.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Field orientation="horizontal">
                            <MutationButton
                                type="submit"
                                form="add-person-to-team-form"
                                status={mutation.status}
                                text={{
                                    idle: "Add",
                                    pending: "Adding",
                                    success: "Added",
                                }}
                            />
                            <DialogCloseButton type="button" variant="outline">
                                Cancel
                            </DialogCloseButton>
                        </Field>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function RemoveTeamMemberDialog({
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
            async onMutate({ teamId }, context) {
                const queryKey = trpc.teams.listTeamMemberships.queryKey({
                    organizationId,
                    teamId,
                });

                await context.client.cancelQueries({ queryKey });

                const previousData = context.client.getQueryData(queryKey) ?? [];

                context.client.setQueryData(
                    queryKey,
                    previousData.filter((tm) => tm.personId !== person?.id),
                );

                return { previousData };
            },
            onError(error, _data, onMutateResult, context) {
                if (onMutateResult?.previousData) {
                    const queryKey = trpc.teams.listTeamMemberships.queryKey({
                        organizationId,
                        teamId: team.id,
                    });
                    context.client.setQueryData(queryKey, onMutateResult.previousData);
                }

                console.error("Failed to remove team member:", error);
                toast.error(`Failed to remove team member: ${error.message}`);
            },
            onSuccess() {
                toast.success("Team member removed");

                handleOpenChange(false);
            },
            onSettled(_result, _error, _data, _onMutateResult, context) {
                context.client.invalidateQueries(
                    trpc.teams.listTeamMemberships.queryFilter({
                        organizationId,
                        teamId: team.id,
                    }),
                );
                context.client.invalidateQueries(
                    trpc.teams.listTeamMemberships.queryFilter({
                        organizationId,
                        personId: person?.id,
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

function SyncD4HTeamDialog({ team, ...props }: ComponentProps<typeof Dialog> & { team: TeamData }) {
    const syncMutation = useMutation(
        trpc.teams.syncronizeD4HTeam.mutationOptions({
            onError(error) {
                console.error("Failed to synchronize with D4H:", error);
                toast.error(`Failed to synchronize with D4H: ${error.message}`);
            },
            onSuccess() {
                toast.success("Team synchronized with D4H");

                handleOpenChange(false);
            },
            onSettled(result, error, variables, _onMutateResult, context) {
                // Invalidate team memberships to reflect any changes from the sync
                context.client.invalidateQueries(
                    trpc.teams.listTeamMemberships.queryFilter({
                        organizationId: team.organizationId,
                        teamId: team.id,
                    }),
                );
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            syncMutation.reset();
        }
        props.onOpenChange?.(open);
    }

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Synchronize with D4H</DialogTitle>
                    <DialogDescription>
                        This will synchronize the team with its linked D4H team, adding and removing
                        personnel as needed to match the D4H team composition. Are you sure you want
                        to proceed?
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Field orientation="horizontal">
                        <MutationButton
                            type="button"
                            status={syncMutation.status}
                            text={{
                                idle: "Synchronize",
                                pending: "Synchronizing",
                                success: "Synchronized",
                            }}
                            onClick={() =>
                                syncMutation.mutate({
                                    teamId: team.id,
                                    organizationId: team.organizationId,
                                })
                            }
                        />
                        <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    </Field>
                </FieldGroup>
            </DialogContent>
        </Dialog>
    );
}
