/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type {
    D4HNagOptOut as D4HNagOptOutRecord,
    D4HNagOptOutSource as D4HNagOptOutSourceRecord,
    D4HNagOutcome as D4HNagOutcomeRecord,
    D4HNagRecipient as D4HNagRecipientRecord,
    D4HNagRule as D4HNagRuleRecord,
    D4HNagRun as D4HNagRunRecord,
    D4HNagRunStatus as D4HNagRunStatusRecord,
    D4HNagRunTrigger as D4HNagRunTriggerRecord,
} from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { TeamId, type TeamRef } from "./team";

export type { D4HNagOptOutRecord, D4HNagRecipientRecord, D4HNagRuleRecord, D4HNagRunRecord };

// IDs

export const D4HNagRuleId = {
    schema: zodNanoId16("D4HNagRuleId expected").brand<"D4HNagRuleId">(),

    create: (): D4HNagRuleId => D4HNagRuleId.schema.parse(nanoId16()),
} as const;

export type D4HNagRuleId = string & z.BRAND<"D4HNagRuleId">;

export const D4HNagRunId = {
    schema: zodNanoId16("D4HNagRunId expected").brand<"D4HNagRunId">(),

    create: (): D4HNagRunId => D4HNagRunId.schema.parse(nanoId16()),
} as const;

export type D4HNagRunId = string & z.BRAND<"D4HNagRunId">;

export const D4HNagRecipientId = {
    schema: zodNanoId16("D4HNagRecipientId expected").brand<"D4HNagRecipientId">(),

    create: (): D4HNagRecipientId => D4HNagRecipientId.schema.parse(nanoId16()),
} as const;

export type D4HNagRecipientId = string & z.BRAND<"D4HNagRecipientId">;

export const D4HNagOptOutId = {
    schema: zodNanoId16("D4HNagOptOutId expected").brand<"D4HNagOptOutId">(),

    create: (): D4HNagOptOutId => D4HNagOptOutId.schema.parse(nanoId16()),
} as const;

export type D4HNagOptOutId = string & z.BRAND<"D4HNagOptOutId">;

// Enums

/** What started a run: the hourly dispatcher, or a user's Run now / Dry run. */
export const D4HNagRunTrigger = {
    schema: z.enum(["Cron", "Manual"]),
} as const;

export type D4HNagRunTrigger = z.infer<typeof D4HNagRunTrigger.schema>;

/** A run's lifecycle: `Running → Completed | Failed`. A run stuck `Running` is timed out to `Failed`. */
export const D4HNagRunStatus = {
    schema: z.enum(["Running", "Completed", "Failed"]),
} as const;

export type D4HNagRunStatus = z.infer<typeof D4HNagRunStatus.schema>;

/**
 * What happened to one recipient. `Pending` holds the once-only claim while the send is in
 * progress. A dry run records every outcome except `Pending`, `Sent` and `Failed`, with `DryRun`
 * in place of a send.
 */
export const D4HNagOutcome = {
    schema: z.enum([
        "Pending",
        "Sent",
        "Failed",
        "SkippedNoEmail",
        "SkippedOptedOut",
        "SkippedAlreadyReminded",
        "DryRun",
    ]),
} as const;

export type D4HNagOutcome = z.infer<typeof D4HNagOutcome.schema>;

/** Who made an opt-out: the member through their email link, or an admin. */
export const D4HNagOptOutSource = {
    schema: z.enum(["Self", "Admin"]),
} as const;

export type D4HNagOptOutSource = z.infer<typeof D4HNagOptOutSource.schema>;

// Fails to compile if a Zod enum and its Prisma enum drift apart, in either direction.
type _EnumsMatchPrisma = [
    AssertTrue<D4HNagRunTrigger extends D4HNagRunTriggerRecord ? true : false>,
    AssertTrue<D4HNagRunTriggerRecord extends D4HNagRunTrigger ? true : false>,
    AssertTrue<D4HNagRunStatus extends D4HNagRunStatusRecord ? true : false>,
    AssertTrue<D4HNagRunStatusRecord extends D4HNagRunStatus ? true : false>,
    AssertTrue<D4HNagOutcome extends D4HNagOutcomeRecord ? true : false>,
    AssertTrue<D4HNagOutcomeRecord extends D4HNagOutcome ? true : false>,
    AssertTrue<D4HNagOptOutSource extends D4HNagOptOutSourceRecord ? true : false>,
    AssertTrue<D4HNagOptOutSourceRecord extends D4HNagOptOutSource ? true : false>,
];
type AssertTrue<T extends true> = T;

// Rules

/** Why a rule won't run, in the order they're checked (decision 6). The first that fails is shown. */
export const D4HNagPausedReason = {
    schema: z.enum([
        "d4h-disabled",
        "disabled",
        "team-inactive",
        "team-unlinked",
        "no-token",
        "token-cannot-see-team",
    ]),
} as const;

export type D4HNagPausedReason = z.infer<typeof D4HNagPausedReason.schema>;

const ruleFieldsSchema = z.object({
    /** 0–6, Sunday = 0 (as `Date.getDay()`), in the org's timezone. */
    weekday: z.number().int().min(0).max(6),
    /** 0–23, in the org's timezone. */
    hour: z.number().int().min(0).max(23),
    lookAheadHours: z.number().int().min(1).max(168),
    /** Optional plain text included in the email; empty for none. */
    message: z.string().trim().max(1000),
    enabled: z.boolean(),
});

const d4hNagRuleSchema = ruleFieldsSchema.extend({
    id: D4HNagRuleId.schema,
    teamId: TeamId.schema,
    lastScheduledFor: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
});

export const D4HNagRuleData = {
    schema: d4hNagRuleSchema,

    /** Input for creating a rule. A rule's team can't be changed afterwards. */
    createSchema: ruleFieldsSchema.extend({
        teamId: TeamId.schema,
        lookAheadHours: ruleFieldsSchema.shape.lookAheadHours.default(24),
        message: ruleFieldsSchema.shape.message.default(""),
        enabled: ruleFieldsSchema.shape.enabled.default(true),
    }),

    /** Input for updating a rule: any of its fields except the team. */
    updateSchema: ruleFieldsSchema.partial(),

    fromRecord: (record: D4HNagRuleRecord): D4HNagRuleData =>
        d4hNagRuleSchema.parse({
            ...record,
            lastScheduledFor: record.lastScheduledFor?.toISOString() ?? null,
            createdAt: record.createdAt.toISOString(),
        }),
} as const;

export type D4HNagRuleData = z.infer<typeof d4hNagRuleSchema>;

export type CreateD4HNagRuleData = z.infer<typeof D4HNagRuleData.createSchema>;

export type UpdateD4HNagRuleData = z.infer<typeof D4HNagRuleData.updateSchema>;

/** A rule as the rules list and the rule page show it. */
export type D4HNagRuleListItem = D4HNagRuleData & {
    team: TeamRef;
    /** The schedule in words, e.g. "Mondays at 19:00". */
    schedule: string;
    /** Why the rule won't run, or `null` when it's runnable. */
    pausedReason: D4HNagPausedReason | null;
    lastRun: { id: D4HNagRunId; startedAt: string; status: D4HNagRunStatus } | null;
};

/** An active AVUT team linked to D4H: one a rule or an opt-out can be made for. */
export interface D4HNagEligibleTeam {
    id: TeamId;
    name: string;
    d4hTeamId: number;
    d4hTeamName: string;
}

/** A team's current D4H members, through the module's token, for picking whom to opt out. */
export type D4HNagTeamMembers =
    | { state: "not-runnable"; reason: D4HNagPausedReason }
    | { state: "ok"; members: { d4hMemberId: number; name: string }[] };

// Opt-outs

export const D4HNagOptOutData = {
    /** Input for an admin adding an opt-out. */
    addSchema: z.object({
        teamId: TeamId.schema,
        d4hMemberId: z.number().int().positive(),
        memberName: z.string().trim().min(1).max(200),
    }),
} as const;

export type AddD4HNagOptOutData = z.infer<typeof D4HNagOptOutData.addSchema>;

export interface D4HNagOptOutListItem {
    id: D4HNagOptOutId;
    team: TeamRef;
    d4hMemberId: number;
    memberName: string;
    source: D4HNagOptOutSource;
    /** The admin who made it; `null` for a self-service opt-out or once the account is purged. */
    createdBy: { id: string; name: string } | null;
    createdAt: string;
}

/**
 * The public opt-out page's view of an email's link token. `optedOut` is true when the member has
 * opted out on any AVUT team in the org linked to the email's D4H team (decision 19).
 */
export type D4HNagOptOutByToken =
    | { state: "not-found" }
    | {
          state: "ok";
          organizationName: string;
          teamName: string;
          memberName: string;
          optedOut: boolean;
      };

// Runs

export interface D4HNagRunListItem {
    id: D4HNagRunId;
    /** `null` once the rule is deleted ("Deleted rule"). */
    ruleId: D4HNagRuleId | null;
    teamId: TeamId;
    teamName: string;
    trigger: D4HNagRunTrigger;
    dryRun: boolean;
    status: D4HNagRunStatus;
    error: string | null;
    startedAt: string;
    completedAt: string | null;
    windowStart: string;
    windowEnd: string;
    exercisesFound: number;
    sentCount: number;
    skippedCount: number;
    failedCount: number;
}

export interface D4HNagRecipientItem {
    id: D4HNagRecipientId;
    d4hExerciseId: number;
    exerciseTitle: string;
    exerciseStartsAt: string;
    d4hMemberId: number;
    memberName: string;
    email: string | null;
    outcome: D4HNagOutcome;
}

/** A run with who started it and every recipient it considered. */
export type D4HNagRunDetail = D4HNagRunListItem & {
    startedBy: { id: string; name: string } | null;
    recipients: D4HNagRecipientItem[];
};
