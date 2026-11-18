/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { D4HServerCode } from "../d4h-servers";

import { OrganizationId } from "./organization";
import { PersonId } from "./person";
import { TeamId } from "./team";
import { TeamMembershipId } from "./team-membership";

export const TeamScopeData = {
    /**
     * The team a team-scope page is about (`/teams/[slug]`): the team, its org, and its stored
     * D4H link, if any. Returned by `Teams.getGrantedBySlug` and `teamScope.getTeam`.
     */
    teamSchema: z.object({
        id: TeamId.schema,
        name: z.string(),
        slug: z.string(),
        description: z.string(),
        organization: z.object({
            id: OrganizationId.schema,
            name: z.string(),
            slug: z.string(),
        }),
        d4h: z
            .object({
                d4hTeamId: z.number(),
                d4hTeamName: z.string(),
                d4hServerCode: D4HServerCode.schema,
            })
            .nullable(),
    }),

    /**
     * A row of a team's roster (its `Active` memberships), as the team dashboard shows it.
     * Returned by `Teams.listRoster` and `teamScope.listRoster`.
     */
    rosterEntrySchema: z.object({
        id: TeamMembershipId.schema,
        person: z.object({ id: PersonId.schema, name: z.string() }),
        d4h: z
            .object({
                d4hPosition: z.string().nullable(),
                d4hRef: z.string().nullable(),
            })
            .nullable(),
    }),

    /**
     * One of the caller's team grants that leads into a team scope: the team (slugged, `Active`)
     * and its org. Returned by `TeamUsers.listForCaller` and `user.listTeamGrants`.
     */
    teamGrantSchema: z.object({
        team: z.object({ id: TeamId.schema, name: z.string(), slug: z.string() }),
        organization: z.object({
            id: OrganizationId.schema,
            name: z.string(),
            slug: z.string(),
        }),
    }),
} as const;

/** The team a team-scope page is about. */
export type TeamScopeTeamData = z.infer<typeof TeamScopeData.teamSchema>;

/** A row of a team's roster. */
export type TeamScopeRosterEntryData = z.infer<typeof TeamScopeData.rosterEntrySchema>;

/** One of the caller's team grants that leads into a team scope. */
export type TeamScopeGrantData = z.infer<typeof TeamScopeData.teamGrantSchema>;
