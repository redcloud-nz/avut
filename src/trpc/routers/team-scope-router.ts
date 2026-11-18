/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TeamScopeData } from "@/lib/schemas/team-scope";
import * as Teams from "@/server/services/teams";

import { createTrpcRouter, teamProcedure } from "../init";

/**
 * Reads for the team scope (`/teams/[slug]`). Every procedure takes `teamSlug` and goes through
 * `teamProcedure`, so the caller must hold a grant on the team.
 */
export const teamScopeRouter = createTrpcRouter({
    /**
     * The team the scope is about: the team, its org and its stored D4H link. Returns the team
     * `teamProcedure`'s access check already loaded, so it adds no query of its own.
     * @throws TRPCError(NOT_FOUND) if the team isn't Active or the caller has no grant on it.
     */
    getTeam: teamProcedure()
        .output(TeamScopeData.teamSchema)
        .query(({ ctx }) => ctx.team),

    /**
     * The team's roster: its Active memberships, ordered by person name.
     * @throws TRPCError(NOT_FOUND) if the team isn't Active or the caller has no grant on it.
     * @throws TRPCError(FORBIDDEN) if the caller lacks `team: ["view"]` in the team's org.
     */
    listRoster: teamProcedure({ team: ["view"] })
        .output(z.array(TeamScopeData.rosterEntrySchema))
        .query(async ({ ctx }) => {
            return await Teams.listRoster(ctx, ctx.teamId);
        }),
});
