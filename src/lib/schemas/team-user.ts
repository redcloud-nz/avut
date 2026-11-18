/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { nanoId16 } from "../id";
import { recordStatusSchema, zodNanoId16 } from "../validation";

import { TeamId, TeamRef } from "./team";
import { UserData, UserId } from "./user";

export const TeamUserId = {
    schema: zodNanoId16("TeamUserId expected").brand<"TeamUserId">(),

    create: (): TeamUserId => TeamUserId.schema.parse(nanoId16()),
};

export type TeamUserId = string & z.BRAND<"TeamUserId">;

export const TeamUserData = {
    /** A member of the organization who can be granted access to a team. */
    grantableUserSchema: UserData.schema.pick({ id: true, name: true, email: true }),

    /**
     * A row of a team's access grants: the granted user, and whether they're also on the
     * team's roster (read-only; the roster is reached through `OrganizationUser.personId`).
     */
    teamGrantSchema: z.object({
        id: TeamUserId.schema,
        teamId: TeamId.schema,
        userId: UserId.schema,
        createdAt: z.iso.datetime(),
        user: UserData.schema.pick({ id: true, name: true, email: true, image: true }),
        onRoster: z.boolean(),
    }),

    /** A row of a user's access grants in one org: the team, its slug and status. */
    userGrantSchema: z.object({
        id: TeamUserId.schema,
        team: TeamRef.schema.extend({
            slug: z.string().nullable(),
            status: recordStatusSchema,
        }),
        createdAt: z.iso.datetime(),
    }),
} as const;

/** A member who can be granted access to a team. */
export type GrantableUserData = z.infer<typeof TeamUserData.grantableUserSchema>;

/** One of a team's access grants. */
export type TeamUserData = z.infer<typeof TeamUserData.teamGrantSchema>;

/** One of a user's access grants. */
export type UserTeamData = z.infer<typeof TeamUserData.userGrantSchema>;
