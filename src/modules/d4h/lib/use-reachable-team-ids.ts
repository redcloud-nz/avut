/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useMemo } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";

/**
 * The ids of the D4H teams the organisation's token can reach. A team owner outside this set has
 * no page to link to.
 */
export function useReachableTeamIds(): ReadonlySet<number> {
    const organization = useOrganization();
    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listTeams.queryOptions({ organizationId: organization.id }),
    );
    return useMemo(() => new Set(teams.map((team) => team.id)), [teams]);
}
