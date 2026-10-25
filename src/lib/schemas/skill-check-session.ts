/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { SkillCheckSession as SkillCheckSessionRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { isQuarterHour } from "../session-timing";
import { zodNanoId16 } from "../validation";

import { OrganizationId } from "./organization";

export const SkillCheckSessionId = {
    schema: zodNanoId16("SkillCheckSessionId expected").brand<"SkillCheckSessionId">(),

    create: () => SkillCheckSessionId.schema.parse(nanoId16()),
} as const;

export type SkillCheckSessionId = string & z.BRAND<"SkillCheckSessionId">;

const skillCheckSessionSchema = z.object({
    id: SkillCheckSessionId.schema,
    organizationId: OrganizationId.schema,
    name: z.string().max(100),
    sessionNumber: z.number().int(),
    /** When the session starts. All day or timed is judged in the org's time zone (`src/lib/session-timing.ts`). */
    startsAt: z.iso.datetime(),
    /** When the session ends, or `null` for a timed session with no end. */
    endsAt: z.iso.datetime().nullable(),
    notes: z.string(),
    status: z.enum(["Draft", "Include", "Exclude"]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

// No `status`: a session is created `Draft` and its status only moves through `approveSession`
// and `reopenSession`. Unrefined, so `updateSession` can parse a stored (possibly off-quarter,
// legacy) session through it to diff, and so it can still be `.pick`ed from.
const modifiableSchema = skillCheckSessionSchema.pick({
    name: true,
    startsAt: true,
    endsAt: true,
    notes: true,
});

export const SkillCheckSession = {
    schema: skillCheckSessionSchema,

    modifiableSchema,

    /**
     * What `createSession` and `updateSession` accept: `modifiableSchema` with both instants on a
     * quarter hour (true in every IANA zone, and rules out stray seconds), and `endsAt` after
     * `startsAt` when present, which together make a 15-minute minimum. Derive nothing from it
     * (Zod 4 throws on `.pick()` of a refined object): use `modifiableSchema`.
     */
    inputSchema: modifiableSchema.superRefine(({ startsAt, endsAt }, ctx) => {
        if (!isQuarterHour(startsAt)) {
            ctx.addIssue({
                code: "custom",
                path: ["startsAt"],
                message: "Start time must be on a quarter hour",
            });
        }
        if (endsAt === null) return;
        if (!isQuarterHour(endsAt)) {
            ctx.addIssue({
                code: "custom",
                path: ["endsAt"],
                message: "End time must be on a quarter hour",
            });
        }
        if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
            ctx.addIssue({
                code: "custom",
                path: ["endsAt"],
                message: "End time must be after the start time",
            });
        }
    }),

    /**
     * A stored session as the API sees it. A row with no `startsAt` shows its `createdAt` instead,
     * for display only: anything that compares against the column uses the raw stored value. An
     * `endsAt` that's null or equal to the start (how legacy rows store "no end") becomes `null`,
     * so diffing an untouched legacy row reports no change.
     */
    fromRecord: (record: SkillCheckSessionRecord) => {
        const startsAt = record.startsAt ?? record.createdAt;
        const endsAt =
            record.endsAt && record.endsAt.getTime() !== startsAt.getTime() ? record.endsAt : null;
        return SkillCheckSession.schema.parse({
            ...record,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt?.toISOString() ?? null,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        });
    },
} as const;

export type SkillCheckSession = z.infer<typeof skillCheckSessionSchema>;

export type ModifiableSkillCheckSession = z.infer<typeof SkillCheckSession.modifiableSchema>;
