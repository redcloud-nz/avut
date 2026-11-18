/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { D4HServerCode } from "../d4h-servers";

import { OrganizationId } from "./organization";
import { TeamId } from "./team";

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
} as const;

/** The team a team-scope page is about. */
export type TeamScopeTeamData = z.infer<typeof TeamScopeData.teamSchema>;
