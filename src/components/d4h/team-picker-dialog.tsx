/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ArrowLeftRightIcon, UsersIcon } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
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
 * Picks one of the D4H teams the viewer's token can reach, opened via `?action=select-team`
 * (or forced open on arrival). Choosing a team navigates to `section(teamId)`, so a team-scoped
 * page passes a builder for its own route and Change team keeps the viewer in the same section.
 */
export function D4HTeamPickerDialog({
    section,
    forceOpen = false,
    label = "Change team",
}: {
    /** The page to go to for the chosen team. */
    section: (teamId: number) => Route;
    forceOpen?: boolean;
    label?: string;
}) {
    const router = useRouter();

    return (
        <PickerDialog
            action="select-team"
            forceOpen={forceOpen}
            icon={<ArrowLeftRightIcon />}
            label={label}
            title="Select a team"
            description="Choose one of your D4H teams."
        >
            {({ dismiss }) => (
                <TeamPicker_List
                    onSelect={(teamId) => {
                        // Navigating drops `?action=` with the rest of the query, so leave it be.
                        dismiss();
                        router.push(section(teamId));
                    }}
                />
            )}
        </PickerDialog>
    );
}

/** The list itself, so its query only runs once the dialog opens. */
function TeamPicker_List({ onSelect }: { onSelect: (teamId: number) => void }) {
    const organization = useOrganization();

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
    );

    const sortedTeams = R.sortBy(teams, (team) => team.title);

    return (
        <Command className="max-sm:min-h-0 max-sm:flex-1">
            <CommandInput placeholder="Search teams…" />
            <CommandList className="max-sm:max-h-none max-sm:flex-1 sm:h-72">
                <CommandEmpty>No teams match your search.</CommandEmpty>
                {sortedTeams.map((team) => (
                    <CommandItem
                        key={team.id}
                        value={`${team.title} ${team.id}`}
                        onSelect={() => onSelect(team.id)}
                    >
                        <UsersIcon />
                        <span>{team.title}</span>
                    </CommandItem>
                ))}
            </CommandList>
        </Command>
    );
}
