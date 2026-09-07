/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

export const D4H_ACTIVITY_TYPES = ["Event", "Exercise", "Incident"] as const;

export const D4H_ATTENDANCE_STATUSES = ["ABSENT", "ATTENDING", "REQUESTED"] as const;

/** An attendance record linking a member to an activity, from the D4H attendance endpoint. */
export const D4HActivityAttendance = {
    schema: z.object({
        id: z.number(),
        resourceType: z.literal("ActivityAttendance"),
        activity: z.object({
            id: z.number(),
            resourceType: z.enum(D4H_ACTIVITY_TYPES),
        }),
        member: z.object({
            id: z.number(),
            resourceType: z.literal("Member"),
        }),
        status: z.enum(D4H_ATTENDANCE_STATUSES),
        startsAt: z.string(),
        endsAt: z.string(),
    }),
} as const;

export type D4HActivityAttendance = z.infer<typeof D4HActivityAttendance.schema>;
