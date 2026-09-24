/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { teamsEffects } from "@/client/teams-effects";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { TeamData, TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

type AddTeamMembershipProps = DialogProps &
    ({ person: PersonRef; team?: undefined } | { team: TeamData; person?: undefined });

/**
 * Adds a team membership, from either side: given a person it picks a team, given a team it
 * picks a person. One dialog, one `?action=add-membership` value, one filtering rule, rather
 * than the two separately-drifting pickers this replaces (`add-person-to-team.tsx`,
 * `add-team-member.tsx`).
 */
export function AdminModule_AddTeamMembership_Dialog({
    person,
    team,
    ...props
}: AddTeamMembershipProps) {
    const title = person ? "Add to Team" : "Add Person to Team";
    const description = person ? (
        <>
            Add <ObjectName>{person.name}</ObjectName> to a team.
        </>
    ) : (
        <>
            Select a person to add to <ObjectName>{team.name}</ObjectName>.
        </>
    );

    return (
        <Dialog {...props}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    {person ? (
                        <PickTeam_Body person={person} onDone={() => props.onOpenChange?.(false)} />
                    ) : (
                        <PickPerson_Body team={team} onDone={() => props.onOpenChange?.(false)} />
                    )}
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function PickTeam_Body({ person, onDone }: { person: PersonRef; onDone: () => void }) {
    const organization = useOrganization();

    const [{ data: teams }, { data: memberships }] = useSuspenseQueries({
        queries: [
            trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
            trpc.teams.listTeamMemberships.queryOptions({
                organizationId: organization.id,
                personId: person.id,
            }),
        ],
    });

    const joinedTeamIds = new Set(memberships.map((m) => m.teamId));
    const teamOptions = teams
        .filter((team) => team.status === "Active" && !joinedTeamIds.has(team.id))
        .map((team) => ({ value: team.id, label: team.name }));

    const form = useForm({
        resolver: zodResolver(z.object({ teamId: TeamId.schema })),
    });

    const mutation = useMutation(
        trpc.teams.createTeamMembership.mutationOptions({
            meta: { effects: teamsEffects.createTeamMembership },
            onError(error) {
                console.error("Failed to add person to team:", error);
                toast.error(`Failed to add person to team: ${error.message}`);
            },
            onSuccess({ created }) {
                toast.success(
                    <>
                        <ObjectName>{person.name}</ObjectName> added to team{" "}
                        <ObjectName>{created.team.name}</ObjectName>.
                    </>,
                );
                onDone();
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            teamId: formData.teamId,
            personId: person.id,
            create: { tags: [], properties: {} },
        });
    });

    return (
        <>
            <DialogBody>
                <form id="add-team-membership-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="teamId"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>Team</FieldLabel>
                                    <SearchableSelect
                                        value={field.value ?? null}
                                        onValueChange={(value) =>
                                            field.onChange((value as TeamId) || null)
                                        }
                                        options={teamOptions}
                                        placeholder="Select a team"
                                        searchPlaceholder="Search teams..."
                                        emptyMessage="No teams found."
                                        aria-invalid={fieldState.invalid}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="submit"
                    form="add-team-membership-form"
                    status={mutation.status}
                    text={{ idle: "Add", pending: "Adding", success: "Added" }}
                />
            </DialogFooter>
        </>
    );
}

function PickPerson_Body({ team, onDone }: { team: TeamData; onDone: () => void }) {
    const organization = useOrganization();

    const [{ data: personnel }, { data: teamMemberships }] = useSuspenseQueries({
        queries: [
            trpc.personnel.listPersonnel.queryOptions({
                organizationId: organization.id,
            }),
            trpc.teams.listTeamMemberships.queryOptions({
                organizationId: organization.id,
                teamId: team.id,
            }),
        ],
    });

    const assignedIds = new Set(teamMemberships.map((tm) => tm.personId));
    const personOptions = [...personnel]
        .filter((person) => person.status === "Active" && !assignedIds.has(person.id))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((person) => ({ value: person.id, label: person.name }));

    const form = useForm({
        resolver: zodResolver(
            z.object({
                personId: PersonId.schema,
            }),
        ),
    });

    const mutation = useMutation(
        trpc.teams.createTeamMembership.mutationOptions({
            meta: { effects: teamsEffects.createTeamMembership },
            onError(error) {
                console.error("Failed to add team member:", error);
                toast.error(`Failed to add team member: ${error.message}`);
            },
            onSuccess({ created }) {
                toast.success(
                    <>
                        <ObjectName>{created.person.name}</ObjectName> added to team{" "}
                        <ObjectName>{team.name}</ObjectName>.
                    </>,
                );

                onDone();
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            mutation.mutate({
                organizationId: organization.id,
                teamId: team.id,
                personId: formData.personId,
                create: {
                    tags: [],
                    properties: {},
                },
            });
        },
        (errors) => {
            console.error("Form validation errors:", errors);
        },
    );

    return (
        <>
            <DialogBody>
                <form id="add-team-membership-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="personId"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel>Person</FieldLabel>
                                    <SearchableSelect
                                        value={field.value ?? null}
                                        onValueChange={(value) =>
                                            field.onChange((value as PersonId) || null)
                                        }
                                        options={personOptions}
                                        placeholder="Select a person"
                                        searchPlaceholder="Search personnel..."
                                        emptyMessage="No personnel found."
                                        aria-invalid={fieldState.invalid}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="submit"
                    form="add-team-membership-form"
                    status={mutation.status}
                    text={{
                        idle: "Add",
                        pending: "Adding",
                        success: "Added",
                    }}
                />
            </DialogFooter>
        </>
    );
}
