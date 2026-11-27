/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { SelfAuditDeliveryStatus as SelfAuditDeliveryStatusRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

// IDs

export const SelfAuditCampaignId = {
    schema: zodNanoId16("SelfAuditCampaignId expected").brand<"SelfAuditCampaignId">(),

    create: (): SelfAuditCampaignId => SelfAuditCampaignId.schema.parse(nanoId16()),
} as const;

export type SelfAuditCampaignId = string & z.BRAND<"SelfAuditCampaignId">;

export const SelfAuditRequestId = {
    schema: zodNanoId16("SelfAuditRequestId expected").brand<"SelfAuditRequestId">(),

    create: (): SelfAuditRequestId => SelfAuditRequestId.schema.parse(nanoId16()),
} as const;

export type SelfAuditRequestId = string & z.BRAND<"SelfAuditRequestId">;

/**
 * How a request's last send went. `Unsent`: on a Draft, no link yet. `Pending`: claimed, send not
 * confirmed.
 */
export const SelfAuditDeliveryStatus = z.enum([
    "Unsent",
    "Pending",
    "Sent",
    "Failed",
    "NoEmail",
]) satisfies z.ZodType<SelfAuditDeliveryStatusRecord>;

export type SelfAuditDeliveryStatus = z.infer<typeof SelfAuditDeliveryStatus>;

/**
 * A request's one status, merging its delivery and its progress, in precedence order: the first
 * that applies wins (`statusOf` in `src/server/services/self-audit-campaigns.ts`). `Editing`:
 * submitted, then reopened. `Sent` includes `Pending`; `Unsent` is a Draft's member.
 */
export const SelfAuditStatus = z.enum([
    "Withdrawn",
    "Submitted",
    "Editing",
    "Opened",
    "Failed",
    "NoEmail",
    "Sent",
    "Unsent",
]);

export type SelfAuditStatus = z.infer<typeof SelfAuditStatus>;

/** The longest name a self audit campaign may be given. */
export const SELF_AUDIT_CAMPAIGN_NAME_MAX = 100;

/** How long a self-audit link works, from its send (or resend). */
export const SELF_AUDIT_TOKEN_DAYS = 14;

/** The most members one self audit campaign may be sent to. */
export const SELF_AUDIT_RECIPIENTS_MAX = 200;

/** A self-audit email's link token. Anything that isn't one simply resolves to `not-found`. */
export const selfAuditTokenSchema = z.string().min(1).max(200);

// Limits on what a member's answer may hold, so a public save can't store an unbounded blob.

/** The longest id or record key: template, variant and D4H item ids, and the choice keywords. */
const ID_MAX = 100;
/** The most held items or bundle templates one answer may cover. */
export const SELF_AUDIT_ANSWERS_MAX = 300;
/** The most extra rows one answer may add. */
export const SELF_AUDIT_EXTRAS_MAX = 50;
export const SELF_AUDIT_SERIAL_MAX = 100;
export const SELF_AUDIT_SIZE_MAX = 50;
export const SELF_AUDIT_ITEM_MAX = 200;
export const SELF_AUDIT_NOTES_MAX = 1000;
export const SELF_AUDIT_COMMENTS_MAX = 4000;

const idSchema = z.string().max(ID_MAX);

/** A record keyed by id, with at most `max` entries. */
function cappedRecord<T extends z.ZodType>(value: T, max: number) {
    return z
        .record(idSchema, value)
        .refine((record) => Object.keys(record).length <= max, `At most ${max} entries.`);
}

// Snapshots: a campaign's templates at create, a member's held items when they're added

/** A brand/model a template allows: one of its I3 variants. */
export const SelfAuditVariant = z.object({
    id: z.string(),
    label: z.string(),
});

export type SelfAuditVariant = z.infer<typeof SelfAuditVariant>;

/** A bundle line: an I3 template. */
export const SelfAuditTemplate = z.object({
    id: z.string(),
    category: z.string(),
    name: z.string(),
    /** Empty when the template doesn't restrict brand/model. */
    variants: z.array(SelfAuditVariant),
    /** Whether an item of this template must have a serial number. */
    requireSN: z.boolean(),
    /** The sizes to pick from for a new one; free text when `sized` and empty. */
    sized: z.boolean(),
    /** The member may leave the size blank (templates don't record sizes yet). */
    sizeOptional: z.boolean().optional(),
    sizeOptions: z.array(z.string()),
    /** Shown in a free-text size field, e.g. "EU size". */
    sizeHint: z.string().optional(),
});

export type SelfAuditTemplate = z.infer<typeof SelfAuditTemplate>;

/** What a held item's D4H record is missing, which the member is asked to fill in. */
export const SelfAuditProblem = z.enum(["serial", "variant"]);

export type SelfAuditProblem = z.infer<typeof SelfAuditProblem>;

/** An item D4H records as issued to the member. */
export const SelfAuditHeldItem = z.object({
    /** The D4H item id. */
    id: z.string(),
    templateId: z.string(),
    /** Brand and model, or the D4H ref for keys and cards. */
    description: z.string(),
    serial: z.string().nullable(),
    /** The variant the record matches, when it matches one. */
    variantId: z.string().nullable(),
    problems: z.array(SelfAuditProblem),
});

export type SelfAuditHeldItem = z.infer<typeof SelfAuditHeldItem>;

// The member's answer: a `FormInstance`'s `formData`, and a request's `submittedData`

/**
 * The member's answer for one held item or one missing template. `has` is Yes, No, Not sure, or
 * not yet answered. Not sure asks nothing more, and is neither a need nor a held item. The demo's
 * "Using my own" isn't offered (decision 4), so a save carrying it is refused.
 */
export const SelfAuditAnswerData = z.object({
    has: z.enum(["yes", "no", "unsure"]).nullable(),
    /** has = yes: the serial, when the record lacks one (or none is recorded). */
    serial: z.string().max(SELF_AUDIT_SERIAL_MAX),
    /** has = yes: the variant they hold, when the record doesn't say (or none is recorded). */
    variantId: idSchema,
    /** has = yes: they asked for a replacement. */
    replace: z.boolean(),
    /** replace: the same variant again, or a different one. */
    replaceWith: z.enum(["same", "different"]).nullable(),
    /** The variant they want (replace = different, or has = no), or `NOT_NEEDED` when has = no. */
    wantVariantId: idSchema,
    /** The size of the one they want, when the template is sized. */
    size: z.string().max(SELF_AUDIT_SIZE_MAX),
    notes: z.string().max(SELF_AUDIT_NOTES_MAX),
});

export type SelfAuditAnswerData = z.infer<typeof SelfAuditAnswerData>;

/** Something the member has or needs that isn't on the list. */
export const SelfAuditExtraItem = z.object({
    id: idSchema,
    item: z.string().max(SELF_AUDIT_ITEM_MAX),
    kind: z.enum(["have", "need"]).nullable(),
    size: z.string().max(SELF_AUDIT_SIZE_MAX),
    notes: z.string().max(SELF_AUDIT_NOTES_MAX),
});

export type SelfAuditExtraItem = z.infer<typeof SelfAuditExtraItem>;

/** A member's whole answer, as saved and submitted. */
export const SelfAuditResponseData = z.object({
    /** Keyed by held item id (the D4H item id). */
    held: cappedRecord(SelfAuditAnswerData, SELF_AUDIT_ANSWERS_MAX),
    /** Keyed by template id, for the bundle's templates D4H records nothing of. */
    missing: cappedRecord(SelfAuditAnswerData, SELF_AUDIT_ANSWERS_MAX),
    extras: z.array(SelfAuditExtraItem).max(SELF_AUDIT_EXTRAS_MAX),
    comments: z.string().max(SELF_AUDIT_COMMENTS_MAX),
});

export type SelfAuditResponseData = z.infer<typeof SelfAuditResponseData>;
