/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ObjectName } from "@/components/ui/typography";

import { teamsInvalidations } from "@/client/teams-invalidations";
import { useOrganization } from "@/hooks/use-organization";
import { PersonId } from "@/lib/schemas/person";
import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_AddTeamMember_Dialog({ team }: { team: TeamData }) {
    const organization = useOrganization();

    const [dialogOpen, setDialogOpen] = useState(false);

    const personnelQuery = useQuery(
        trpc.personnel.listPersonnel.queryOptions({
            organizationId: organization.id,
        }),
    );
    const personnel = (personnelQuery.data ?? []).sort((a, b) => a.name.localeCompare(b.name));

    const teamMembershipsQuery = useQuery(
        trpc.teams.listTeamMemberships.queryOptions({
            organizationId: organization.id,
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
            meta: { invalidates: teamsInvalidations.createTeamMembership },
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

                handleOpenChange(false);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            form.reset();
            mutation.reset();
        }
        setDialogOpen(open);
    }

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
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ObjectIcons.Create /> <span className="hidden md:inline">New Member</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Person to Team</DialogTitle>
                    <DialogDescription>
                        Select a person to add to <ObjectName>{team.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <form id="add-person-to-team-form" onSubmit={handleSubmit}>
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
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
