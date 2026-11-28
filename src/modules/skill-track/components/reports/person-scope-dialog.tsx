/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { TelescopeIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useMemo } from "react";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";

import { PickerDialog } from "@/components/picker-dialog";
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { useOrganization } from "@/hooks/use-organization";
import type { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

/**
 * Scope picker for the Personnel Competency report, presented as a command dialog rather
 * than a full-page list. Opened via `?action=select-scope` (or forced open by the report
 * when nothing is picked yet); choosing a person sets `?person=<id>`. With `team` set (team
 * scope) it lists the team's roster instead of the organisation's personnel.
 */
export function SkillTrack_PersonScopeDialog({
    forceOpen = false,
    label = "Change scope",
    compact = false,
    team,
}: {
    forceOpen?: boolean;
    label?: string;
    /** Hide the trigger button below `sm` — the report offers it in the dropdown menu instead. */
    compact?: boolean;
    /** List only this team's roster. */
    team?: { id: TeamId; name: string };
}) {
    const [, setPerson] = useQueryState("person");

    return (
        <PickerDialog
            action="select-scope"
            forceOpen={forceOpen}
            icon={<TelescopeIcon />}
            label={label}
            compact={compact}
            title="Select a person"
            description="Choose a person to view their competency report."
        >
            {({ close }) => {
                const onSelect = (personId: string) => {
                    void setPerson(personId, { history: "push" });
                    close();
                };
                return team ? (
                    <PersonScope_RosterPicker teamId={team.id} onSelect={onSelect} />
                ) : (
                    <PersonScope_Picker onSelect={onSelect} />
                );
            }}
        </PickerDialog>
    );
}

/**
 * The Active people on a team's roster (a non-`Deleted` membership), sorted by name. Like the
 * org picker, it leaves out Archived people: the competency report only resolves Active
 * personnel, so theirs would be empty. The team-scope report reads it to check `?person=` too,
 * so the page prefetches it.
 */
export function useTeamRosterPeople(teamId: TeamId) {
    const organization = useOrganization();

    const { data: memberships } = useSuspenseQuery(
        trpc.teams.listTeamMemberships.queryOptions({ organizationId: organization.id, teamId }),
    );

    return useMemo(
        () =>
            R.pipe(
                memberships,
                R.map((membership) => membership.person),
                R.filter((person) => person.status === "Active"),
                R.sortBy((person) => person.name),
            ),
        [memberships],
    );
}

/** The team-scope list: the team's roster. */
function PersonScope_RosterPicker({
    teamId,
    onSelect,
}: {
    teamId: TeamId;
    onSelect: (personId: string) => void;
}) {
    const people = useTeamRosterPeople(teamId);

    return (
        <Command className="max-sm:min-h-0 max-sm:flex-1">
            <CommandInput placeholder="Search people…" />
            <CommandList className="max-sm:max-h-none max-sm:flex-1 sm:h-72">
                <CommandEmpty>No team members match your search.</CommandEmpty>
                {people.map((person) => (
                    <CommandItem
                        key={person.id}
                        value={`${person.name} ${person.email}`}
                        onSelect={() => onSelect(person.id)}
                    >
                        <span>{person.name}</span>
                        <span className="text-muted-foreground">{person.email}</span>
                    </CommandItem>
                ))}
            </CommandList>
        </Command>
    );
}

/**
 * The list itself, rendered inside `DialogContent` so its query only runs once the dialog
 * opens — the dialog is always mounted in the report header.
 */
function PersonScope_Picker({ onSelect }: { onSelect: (personId: string) => void }) {
    const organization = useOrganization();

    const { data: personnel } = useSuspenseQuery(
        trpc.personnel.listPersonnel.queryOptions({ organizationId: organization.id }),
    );

    // The competency report only resolves active personnel — archived people would render
    // an empty report.
    const activePersonnel = useMemo(
        () =>
            R.pipe(
                personnel,
                R.filter((person) => person.status === "Active"),
                R.sortBy((person) => person.name),
            ),
        [personnel],
    );

    return (
        <Command className="max-sm:min-h-0 max-sm:flex-1">
            <CommandInput placeholder="Search people…" />
            <CommandList className="max-sm:max-h-none max-sm:flex-1 sm:h-72">
                <CommandEmpty>No active personnel match your search.</CommandEmpty>
                {activePersonnel.map((person) => (
                    <CommandItem
                        key={person.id}
                        value={`${person.name} ${person.email}`}
                        onSelect={() => onSelect(person.id)}
                    >
                        <span>{person.name}</span>
                        <span className="text-muted-foreground">{person.email}</span>
                    </CommandItem>
                ))}
            </CommandList>
        </Command>
    );
}
