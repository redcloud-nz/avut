/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";

import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ObjectName } from "@/components/ui/typography";

import { teamsEffects } from "@/client/teams-effects";
import { useOrganization } from "@/hooks/use-organization";
import { PersonRef } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_AddPersonToTeam_Dialog({ person }: { person: PersonRef }) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["add-to-team"] as const),
    );
    const dialogOpen = action === "add-to-team";

    const teamsQuery = useQuery(
        trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
    );
    const membershipsQuery = useQuery(
        trpc.teams.listTeamMemberships.queryOptions({
            organizationId: organization.id,
            personId: person.id,
        }),
    );

    const joinedTeamIds = new Set((membershipsQuery.data ?? []).map((m) => m.teamId));
    const teamOptions = (teamsQuery.data ?? [])
        .filter((team) => !joinedTeamIds.has(team.id))
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
                handleOpenChange(false);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        void setAction(open ? "add-to-team" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset();
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            teamId: formData.teamId,
            personId: person.id,
            create: { tags: [], properties: {} },
        });
    });

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add to Team</DialogTitle>
                    <DialogDescription>
                        Add <ObjectName>{person.name}</ObjectName> to a team.
                    </DialogDescription>
                </DialogHeader>
                <form id="add-person-to-team-form" onSubmit={handleSubmit}>
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
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="add-person-to-team-form"
                        status={mutation.status}
                        text={{ idle: "Add", pending: "Adding", success: "Added" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
