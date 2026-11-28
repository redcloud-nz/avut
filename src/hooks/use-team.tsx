/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";

import type { TeamData } from "@/lib/schemas/team";

interface TeamScope {
    team: TeamData;
    /** The URL's slug: unlike `TeamData.slug`, never null in team scope. */
    teamSlug: string;
}

const TeamContext = createContext<TeamScope | null>(null);

/**
 * Provides the team-scoped subtree (`/teams/[slug]`) with the team, as `requireTeam` loaded it in
 * the team layout, and the URL's slug. Unlike `OrganizationProvider`, it carries the data itself
 * rather than keying a query: the team is a server snapshot, so a team-scope edit must call
 * `router.refresh()` to show its change here.
 *
 * Team pages also sit inside an `OrganizationProvider` for the team's org, so `<Protect>`,
 * `useHasPermission` and `useOrganization` work there as in org scope.
 */
export function TeamProvider({ children, team, teamSlug }: TeamScope & { children: ReactNode }) {
    const scope = useMemo(() => ({ team, teamSlug }), [team, teamSlug]);

    return <TeamContext.Provider value={scope}>{children}</TeamContext.Provider>;
}

function useTeamScope(): TeamScope {
    const scope = useContext(TeamContext);
    if (!scope) {
        throw new Error("useTeam must be used within a TeamProvider");
    }
    return scope;
}

/**
 * The team the current team-scope page is about, with its stored D4H link (whose
 * `d4hOrganisationName` reads as null), from the team layout's `requireTeam`. No query: see
 * `TeamProvider`.
 */
export function useTeam(): TeamData {
    return useTeamScope().team;
}

/**
 * The current team-scope page's team, or null outside a `TeamProvider` (in org scope, or
 * outside both scopes). Never throws, so a component shared between the org and team scopes
 * can ask which one it's in.
 */
export function useOptionalTeam(): TeamData | null {
    return useContext(TeamContext)?.team ?? null;
}

/** The current team scope's slug, from the URL (never null, unlike `TeamData.slug`). */
export function useTeamSlug(): string {
    return useTeamScope().teamSlug;
}
