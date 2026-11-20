/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { useSuspenseQueries } from "@tanstack/react-query";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { OrganizationId } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

interface D4HTeamMemberSelectProps {
    value: { id: number; teamId: number; name: string };
    onChange: (value: { id: number; teamId: number; name: string }) => void;
    organizationId: OrganizationId;
    id?: string;
    placeholder?: string;
    "aria-invalid"?: boolean;
}

/**
 * A searchable select for choosing a D4H team member, across every team the organization's D4H
 * tokens reach. With more than one team, each member shows their team, and the search matches it.
 *
 * @param organizationId - The ID of the organization to fetch teams and members for.
 * @param value - The currently selected member (`id` 0 for none).
 * @param onChange - Called with the selected member's id, team id and name.
 */
export function D4HTeamMemberSelect({
    value,
    onChange,
    organizationId,
    id,
    placeholder = "Select a person",
    "aria-invalid": ariaInvalid,
}: D4HTeamMemberSelectProps) {
    const [{ data: teams }, { data: members }] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.listTeams.queryOptions({ organizationId }),
            trpc.d4hApi.listMembers.queryOptions({ organizationId }),
        ],
    });

    const teamTitles = new Map(teams.map((team) => [team.id, team.title]));
    const listedMembers = members.filter((member) => teamTitles.has(member.team.id));
    const showTeams = new Set(listedMembers.map((member) => member.team.id)).size > 1;

    const options = listedMembers
        .toSorted(
            (a, b) =>
                a.name.localeCompare(b.name) ||
                teamTitles.get(a.team.id)!.localeCompare(teamTitles.get(b.team.id)!),
        )
        .map((member) => ({
            value: member.id + "",
            label: member.name,
            subtitle: showTeams ? teamTitles.get(member.team.id) : undefined,
        }));

    function handleChange(newValue: string) {
        const memberId = parseInt(newValue, 10);
        const selectedMember = members.find((member) => member.id === memberId);
        if (selectedMember) {
            onChange({
                id: selectedMember.id,
                teamId: selectedMember.team.id,
                name: selectedMember.name,
            });
        }
    }

    // The same person is often a member of several teams, so the trigger names the team too. A
    // saved member who's no longer listed still shows by their saved name.
    const selectedTeamTitle = teamTitles.get(value.teamId);
    const valueLabel = (
        <span className="flex items-center gap-1.5">
            {members.find((member) => member.id === value.id)?.name ?? value.name}
            {selectedTeamTitle && showTeams && (
                <span className="text-muted-foreground">{selectedTeamTitle}</span>
            )}
        </span>
    );

    return (
        <SearchableSelect
            id={id}
            value={value.id == 0 ? "" : value.id + ""}
            onValueChange={handleChange}
            options={options}
            valueLabel={valueLabel}
            placeholder={placeholder}
            searchPlaceholder="Search by name or team..."
            emptyMessage="No one matches."
            aria-invalid={ariaInvalid}
        />
    );
}
