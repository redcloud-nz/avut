/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { ComponentProps, useState } from "react";
import { toast } from "sonner";

import { eq, useLiveQuery } from "@tanstack/react-db";

import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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

import { getPersonnelCollection } from "@/lib/collections/personnel";
import { getTeamMembershipsCollection } from "@/lib/collections/team-memberships";
import {
    OrganizationId,
    OrganizationWithSettings,
} from "@/lib/schemas/organization";
import { PersonData, PersonId } from "@/lib/schemas/person";
import { TeamData } from "@/lib/schemas/team";

interface AdminModule_TeamPersonnel_SectionProps {
    organization: OrganizationWithSettings;
    team: TeamData;
}

export function AdminModule_TeamPersonnel_Section({
    organization,
    team,
}: AdminModule_TeamPersonnel_SectionProps) {
    const teamMembersQuery = useLiveQuery((q) =>
        q
            .from({
                teamMembership: getTeamMembershipsCollection(organization.id),
            })
            .innerJoin(
                { person: getPersonnelCollection(organization.id) },
                ({ teamMembership, person }) =>
                    eq(teamMembership.personId, person.id),
            )
            .where(({ teamMembership }) => eq(teamMembership.teamId, team.id))
            .orderBy(({ person }) => person.name, "asc"),
    );

    const [newMemberDialogOpen, setNewMemberDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<PersonData | null>(null);

    return (
        <Hermes.Section>
            {teamMembersQuery.isLoading ? (
                <>
                    <Hermes.SectionHeader>
                        <Skeleton className="h-8 w-50" />
                        <Skeleton className="h-8 w-20" />
                    </Hermes.SectionHeader>
                    <Skeleton className="h-20 w-full" />
                </>
            ) : (
                <>
                    <Hermes.SectionHeader>
                        <Hermes.SectionTitle>
                            Team Personnel
                        </Hermes.SectionTitle>
                        <Button
                            variant="outline"
                            onClick={() => setNewMemberDialogOpen(true)}
                        >
                            <ObjectIcons.Create /> Person
                        </Button>
                    </Hermes.SectionHeader>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell>Name</TableHeadCell>
                                <TableCell className="w-9"></TableCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teamMembersQuery.data.map(
                                ({ person, teamMembership }) => (
                                    <TableRow key={teamMembership.personId}>
                                        <TableCell>{person.name}</TableCell>
                                        <TableCell className="w-9 p-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setDeleteTarget(person)
                                                }
                                            >
                                                <ObjectIcons.Delete />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ),
                            )}
                        </TableBody>
                    </Table>
                </>
            )}

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
        </Hermes.Section>
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
    const { data: personnel = [] } = useLiveQuery((q) =>
        q
            .from({ person: getPersonnelCollection(organizationId) })
            .orderBy(({ person }) => person.name, "asc"),
    );
    const { data: teamMemberships = [] } = useLiveQuery((q) =>
        q
            .from({
                teamMembership: getTeamMembershipsCollection(organizationId),
            })
            .where(({ teamMembership }) => eq(teamMembership.teamId, team.id)),
    );

    const [selectedId, setSelectedId] = useState<PersonId | null>(null);

    const assignedIds = teamMemberships.map((tm) => tm.personId);

    function handleAdd() {
        const person = personnel.find((p) => p.id === selectedId);

        if (!person) return;

        setSelectedId(null);
        props.onOpenChange?.(false);

        toast.promise(
            async () => {
                const collection = getTeamMembershipsCollection(organizationId);
                const tx = collection.insert({
                    teamId: team.id,
                    personId: person.id,
                    properties: {},
                    tags: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
                await tx.isPersisted.promise;
            },
            {
                loading: `Adding ${person.name} to team...`,
                success: `${person.name} added to team`,
                error: (error) =>
                    `Failed to add ${person.name} to team: ${error.message}`,
            },
        );
    }

    function handleOpenChange(open: boolean) {
        if (!open) {
            setSelectedId(null);
        }
        props.onOpenChange?.(open);
    }

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Person to Team</DialogTitle>
                    <DialogDescription>
                        Select a person to add to{" "}
                        <ObjectName>{team.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Field orientation="horizontal">
                        <FieldLabel>Person</FieldLabel>
                        <Select
                            value={selectedId ?? ""}
                            onValueChange={(value) =>
                                setSelectedId((value as PersonId) || null)
                            }
                        >
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select a person" />
                            </SelectTrigger>
                            <SelectContent>
                                {personnel.map((person) => (
                                    <SelectItem
                                        key={person.id}
                                        value={person.id}
                                        disabled={assignedIds.includes(
                                            person.id,
                                        )}
                                    >
                                        {person.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field orientation="horizontal">
                        <Button
                            type="button"
                            onClick={handleAdd}
                            disabled={selectedId === null}
                        >
                            Add
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                        >
                            Cancel
                        </Button>
                    </Field>
                </FieldGroup>
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
    person: PersonData | null;
} & ComponentProps<typeof Dialog>) {
    function handleRemove() {
        props.onOpenChange?.(false);

        toast.promise(
            async () => {
                const collection = getTeamMembershipsCollection(organizationId);
                const tx = collection.delete(`${team.id}-${person!.id}`);
                await tx.isPersisted.promise;
            },
            {
                loading: `Removing ${person?.name} from team...`,
                success: `${person?.name} removed from team`,
                error: (error) =>
                    `Failed to remove ${person?.name} from team: ${error.message}`,
            },
        );
    }
    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Remove Person from Team</DialogTitle>
                    <DialogDescription>
                        Confirm removal of{" "}
                        <ObjectName>{person?.name}</ObjectName> from{" "}
                        <ObjectName>{team.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                    <Field orientation="horizontal">
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleRemove}
                        >
                            Remove
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => props.onOpenChange?.(false)}
                        >
                            Cancel
                        </Button>
                    </Field>
                </FieldGroup>
            </DialogContent>
        </Dialog>
    );
}
