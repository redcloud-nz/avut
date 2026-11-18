/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/hooks/use-organization";
import type { TeamRef } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { NO_SESSION_TEAM } from "./session-when-picker";

/**
 * A session's Team field: "No team (whole organisation)" or one of the org's `Active` teams, by
 * name. `currentTeam` (the session's team, when editing) is offered too when it isn't active, so
 * the edit dialog never opens on a blank value. Controlled over a team id or `NO_SESSION_TEAM`.
 */
export function SkillTrack_SessionTeamSelect({
    id,
    value,
    onChange,
    currentTeam,
    invalid,
}: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    currentTeam?: TeamRef | null;
    invalid?: boolean;
}) {
    const organization = useOrganization();
    const teamsQuery = useQuery(
        trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
    );

    const options = useMemo(() => {
        const active: TeamRef[] = (teamsQuery.data ?? [])
            .filter((team) => team.status === "Active")
            .map((team) => ({ id: team.id, name: team.name }));
        if (currentTeam && !active.some((team) => team.id === currentTeam.id)) {
            active.push(currentTeam);
            active.sort((a, b) => a.name.localeCompare(b.name));
        }
        return active;
    }, [teamsQuery.data, currentTeam]);

    return (
        <Select
            value={value}
            disabled={teamsQuery.isPending}
            onValueChange={(next) => {
                // Radix fires "" when it mounts or resets inside a form; that isn't a choice.
                if (next) onChange(next);
            }}
        >
            <SelectTrigger id={id} aria-invalid={invalid} className="w-full">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NO_SESSION_TEAM}>No team (whole organisation)</SelectItem>
                {options.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                        {team.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
