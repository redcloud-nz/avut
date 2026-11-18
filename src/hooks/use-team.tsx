/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { createContext, ReactNode, useContext, useMemo } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import type { OrganizationId } from "@/lib/schemas/organization";
import type { TeamData, TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

interface TeamIdentity {
    organizationId: OrganizationId;
    teamId: TeamId;
    /** The URL's slug: unlike `TeamData.slug`, never null in team scope. */
    teamSlug: string;
}

const TeamContext = createContext<TeamIdentity | null>(null);

/**
 * Provides the team-scoped subtree (`/teams/[slug]`) with the team's ids and slug, just enough to
 * key `useTeam`'s query. Like `OrganizationProvider`, it carries no fetched data: the team layout
 * seeds `teams.getTeam` from `requireTeam` with `queryClient.setQueryData`.
 *
 * Team pages also sit inside an `OrganizationProvider` for the team's org, so `<Protect>`,
 * `useHasPermission` and `useOrganization` work there as in org scope.
 */
export function TeamProvider({
    children,
    organizationId,
    teamId,
    teamSlug,
}: TeamIdentity & { children: ReactNode }) {
    const identity = useMemo(
        () => ({ organizationId, teamId, teamSlug }),
        [organizationId, teamId, teamSlug],
    );

    return <TeamContext.Provider value={identity}>{children}</TeamContext.Provider>;
}

function useTeamIdentity(): TeamIdentity {
    const identity = useContext(TeamContext);
    if (!identity) {
        throw new Error("useTeam must be used within a TeamProvider");
    }
    return identity;
}

/**
 * The team the current team-scope page is about, with its stored D4H link, read through the org
 * procedure `teams.getTeam` (checked by the caller's org permissions, not the team grant).
 */
export function useTeam(): TeamData {
    const { organizationId, teamId } = useTeamIdentity();

    const { data: team } = useSuspenseQuery(
        trpc.teams.getTeam.queryOptions({ organizationId, teamId }),
    );

    return team;
}

/** The current team scope's slug, from the URL (never null, unlike `TeamData.slug`). */
export function useTeamSlug(): string {
    return useTeamIdentity().teamSlug;
}
