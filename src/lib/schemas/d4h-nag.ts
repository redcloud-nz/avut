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
