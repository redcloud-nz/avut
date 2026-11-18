/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import type { TeamScopeTeamData } from "@/lib/schemas/team-scope";
import { trpc } from "@/trpc/client";

interface TeamIdentity {
    teamSlug: string;
}

const TeamContext = createContext<TeamIdentity | null>(null);

/**
 * Provides the team-scoped subtree (`/teams/[slug]`) with the team's slug, just enough to key
 * `useTeam`'s query. Like `OrganizationProvider`, it carries no fetched data: the team layout
 * seeds `teamScope.getTeam` from `requireTeam` with `queryClient.setQueryData`.
 *
 * Team pages also sit inside an `OrganizationProvider` for the team's org, so `<Protect>`,
 * `useHasPermission` and `useOrganization` work there as in org scope.
 */
export function TeamProvider({ children, teamSlug }: TeamIdentity & { children: ReactNode }) {
    const identity = useMemo(() => ({ teamSlug }), [teamSlug]);

    return <TeamContext.Provider value={identity}>{children}</TeamContext.Provider>;
}

/** The team the current team-scope page is about, with its org and stored D4H link. */
export function useTeam(): TeamScopeTeamData {
    const identity = useContext(TeamContext);
    if (!identity) {
        throw new Error("useTeam must be used within a TeamProvider");
    }

    const { data: team } = useSuspenseQuery(
        trpc.teamScope.getTeam.queryOptions({ teamSlug: identity.teamSlug }),
    );

    return team;
}
