/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { useOrganization } from "./use-organization";

export function useTeam(teamId: string): TeamData {
    const organization = useOrganization();

    const { data: teams } = useSuspenseQuery(
        trpc.teams.listTeams.queryOptions({
            organizationId: organization.id,
        }),
    );

    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error(`Team(${teamId}) not found`);

    return team;
}
