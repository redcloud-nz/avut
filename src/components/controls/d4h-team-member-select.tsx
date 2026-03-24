/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { ComponentProps, Fragment } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { OrganizationId } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

interface D4HTeamMemberSelectProps {
    value: { id: number; teamId: number; name: string };
    onChange: (value: { id: number; teamId: number; name: string }) => void;
    organizationId: OrganizationId;
    module: "d4h-views" | "i3";
    slotProps?: {
        content?: ComponentProps<typeof SelectContent>;
        trigger?: ComponentProps<typeof SelectTrigger>;
        value?: ComponentProps<typeof SelectValue>;
    };
}

/**
 * A select component for choosing a D4H team member, grouped by their teams.
 * It fetches the list of teams and members from the D4H API and displays them in a grouped select dropdown.
 * When a member is selected, it calls the onChange callback with the selected member's id and name.
 *
 * @param organizationId - The ID of the organization to fetch teams and members for.
 * @param value - The currently selected member, with id and name.
 * @param onChange - Callback function that is called when a member is selected, with the selected member's id and name.
 * @param slotProps - Optional props to pass to the SelectContent, SelectTrigger, and SelectValue components for styling and customization.
 */
export function D4HTeamMemberSelect({
    value,
    onChange,
    organizationId,
    module,
    slotProps = {},
}: D4HTeamMemberSelectProps) {
    const [{ data: teams }, { data: members }] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.listTeams.queryOptions({
                organizationId,
                module,
            }),
            trpc.d4hApi.listMembers.queryOptions({
                organizationId,
                module,
            }),
        ],
    });

    function handleChange(newValue: string) {
        if (newValue === "") {
            onChange({ id: 0, teamId: 0, name: "" });
        } else {
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
    }

    return (
        <Select value={value.id == 0 ? "" : value.id + ""} onValueChange={handleChange}>
            <SelectTrigger {...slotProps.trigger}>
                <SelectValue {...slotProps.value} placeholder="Select a recipient" />
            </SelectTrigger>
            <SelectContent {...slotProps.content}>
                {teams
                    .sort((a, b) => a.title.localeCompare(b.title))
                    .map((team, teamIndex) => {
                        const teamMembers = members.filter((member) => member.team.id === team.id);
                        if (teamMembers.length === 0) {
                            return null;
                        }

                        return (
                            <Fragment key={team.id}>
                                <SelectGroup>
                                    <SelectLabel>{team.title}</SelectLabel>
                                    {teamMembers
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map((member) => (
                                            <SelectItem key={member.id} value={member.id + ""}>
                                                {member.name}
                                            </SelectItem>
                                        ))}
                                </SelectGroup>
                                {teamIndex < teams.length - 1 && <SelectSeparator />}
                            </Fragment>
                        );
                    })}
            </SelectContent>
        </Select>
    );
}
