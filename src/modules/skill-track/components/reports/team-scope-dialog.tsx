/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Building2Icon, TelescopeIcon, UsersIcon } from "lucide-react";
import { useQueryState } from "nuqs";
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
import { trpc } from "@/trpc/client";

/**
 * Scope picker for the team-scoped reports (Team Competency, Personnel × Skill Matrix),
 * presented as a command dialog. Opened via `?action=select-scope` (or forced open when
 * nothing is picked yet); choosing a scope sets `?team=<id|all>`.
 */
export function SkillTrack_TeamScopeDialog({
    forceOpen = false,
    label = "Change scope",
    compact = false,
}: {
    forceOpen?: boolean;
    label?: string;
    /** Hide the trigger button below `sm` — the report offers it in the dropdown menu instead. */
    compact?: boolean;
}) {
    const [, setTeam] = useQueryState("team");

    return (
        <PickerDialog
            action="select-scope"
            forceOpen={forceOpen}
            icon={<TelescopeIcon />}
            label={label}
            compact={compact}
            title="Select a scope"
            description="Choose a team, or the whole organisation."
        >
            {({ close }) => (
                <TeamScope_Picker
                    onSelect={(value) => {
                        void setTeam(value, { history: "push" });
                        close();
                    }}
                />
            )}
        </PickerDialog>
    );
}

/**
 * The list itself, rendered inside `DialogContent` so its query only runs once the dialog
 * opens — the dialog is always mounted in the report header.
 */
function TeamScope_Picker({ onSelect }: { onSelect: (value: string) => void }) {
    const organization = useOrganization();

    const { data: teams } = useSuspenseQuery(
        trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
    );

    const sortedTeams = R.pipe(
        teams,
        R.filter((team) => team.status === "Active"),
        R.sortBy((team) => team.name),
    );

    return (
        <Command className="max-sm:min-h-0 max-sm:flex-1">
            <CommandInput placeholder="Search teams…" />
            <CommandList className="max-sm:max-h-none max-sm:flex-1 sm:h-72">
                <CommandEmpty>No teams match your search.</CommandEmpty>
                <CommandItem value="Whole Organization" onSelect={() => onSelect("all")}>
                    <Building2Icon />
                    <span>Whole Organisation</span>
                </CommandItem>
                {sortedTeams.map((team) => (
                    <CommandItem key={team.id} value={team.name} onSelect={() => onSelect(team.id)}>
                        <UsersIcon />
                        <span>{team.name}</span>
                    </CommandItem>
                ))}
            </CommandList>
        </Command>
    );
}
