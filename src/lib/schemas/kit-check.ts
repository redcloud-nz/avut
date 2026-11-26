/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { KitCheckDeliveryStatus as KitCheckDeliveryStatusRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

// IDs

export const KitCheckId = {
    schema: zodNanoId16("KitCheckId expected").brand<"KitCheckId">(),

    create: (): KitCheckId => KitCheckId.schema.parse(nanoId16()),
} as const;

export type KitCheckId = string & z.BRAND<"KitCheckId">;

export const KitCheckRequestId = {
    schema: zodNanoId16("KitCheckRequestId expected").brand<"KitCheckRequestId">(),

    create: (): KitCheckRequestId => KitCheckRequestId.schema.parse(nanoId16()),
} as const;

export type KitCheckRequestId = string & z.BRAND<"KitCheckRequestId">;

/** How a request's last send went (decision 13). `Pending`: claimed, send not confirmed. */
export const KitCheckDeliveryStatus = z.enum([
    "Pending",
    "Sent",
    "Failed",
    "NoEmail",
]) satisfies z.ZodType<KitCheckDeliveryStatusRecord>;

export type KitCheckDeliveryStatus = z.infer<typeof KitCheckDeliveryStatus>;

/**
 * A request's progress, derived from its timestamps and its instance's `formStatus`, never from
 * its delivery (decision 13). `Editing`: submitted, then reopened (decision 10).
 */
export const KitCheckProgress = z.enum(["NotOpened", "Opened", "Submitted", "Editing"]);

export type KitCheckProgress = z.infer<typeof KitCheckProgress>;

/** How long a kit-check link works, from its send (or resend). */
export const KIT_CHECK_TOKEN_DAYS = 14;

/** A kit-check email's link token. Anything that isn't one simply resolves to `not-found`. */
export const kitCheckTokenSchema = z.string().min(1).max(200);

// Limits on what a member's answer may hold, so a public save can't store an unbounded blob.

/** The longest id or record key: template, variant and D4H item ids, and the choice keywords. */
const ID_MAX = 100;
/** The most held items or bundle templates one answer may cover. */
export const KIT_CHECK_ANSWERS_MAX = 300;
/** The most extra rows one answer may add. */
export const KIT_CHECK_EXTRAS_MAX = 50;
export const KIT_CHECK_SERIAL_MAX = 100;
export const KIT_CHECK_SIZE_MAX = 50;
export const KIT_CHECK_ITEM_MAX = 200;
export const KIT_CHECK_NOTES_MAX = 1000;
export const KIT_CHECK_COMMENTS_MAX = 4000;

const idSchema = z.string().max(ID_MAX);

/** A record keyed by id, with at most `max` entries. */
function cappedRecord<T extends z.ZodType>(value: T, max: number) {
    return z
        .record(idSchema, value)
        .refine((record) => Object.keys(record).length <= max, `At most ${max} entries.`);
}

// Snapshots, taken at send (decision 6 of the kit-check plan)

/** A D4H team a kit check was sent to. */
export const KitCheckD4HTeam = z.object({
    id: z.number().int(),
    title: z.string(),
});

export type KitCheckD4HTeam = z.infer<typeof KitCheckD4HTeam>;

/** The most D4H teams one kit check is sent to. */
export const KIT_CHECK_D4H_TEAMS_MAX = 20;

/** The most members of one D4H team a kit check can be sent to. */
export const KIT_CHECK_TEAM_MEMBERS_MAX = 1000;

/** A D4H team a kit check goes to, and which of its members are sent one. */
export const KitCheckTeamChoice = z.object({
    d4hTeamId: z.number().int(),
    d4hMemberIds: z.array(z.number().int()).max(KIT_CHECK_TEAM_MEMBERS_MAX),
});

export type KitCheckTeamChoice = z.infer<typeof KitCheckTeamChoice>;

/** A brand/model a template allows: one of its I3 variants. */
export const KitCheckVariant = z.object({
    id: z.string(),
    label: z.string(),
});

export type KitCheckVariant = z.infer<typeof KitCheckVariant>;

/** A bundle line: an I3 template. */
export const KitCheckTemplate = z.object({
    id: z.string(),
    category: z.string(),
    name: z.string(),
    /** Empty when the template doesn't restrict brand/model. */
    variants: z.array(KitCheckVariant),
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

export type KitCheckTemplate = z.infer<typeof KitCheckTemplate>;

/**
 * A kit check's templates, per D4H team (decision 6a): which bundle lines can be compared, and
 * which variants are offered, depends on the team. Keyed by the D4H team id, as a string (JSON).
 */
export const KitCheckTemplatesByTeam = z.record(
    z.string().regex(/^\d+$/, "Expected a D4H team id."),
    z.array(KitCheckTemplate),
);

export type KitCheckTemplatesByTeam = z.infer<typeof KitCheckTemplatesByTeam>;

/** What a held item's D4H record is missing, which the member is asked to fill in. */
export const KitCheckProblem = z.enum(["serial", "variant"]);

export type KitCheckProblem = z.infer<typeof KitCheckProblem>;

/** An item D4H records as issued to the member. */
export const KitCheckHeldItem = z.object({
    /** The D4H item id. */
    id: z.string(),
    templateId: z.string(),
    /** Brand and model, or the D4H ref for keys and cards. */
    description: z.string(),
    serial: z.string().nullable(),
    /** The variant the record matches, when it matches one. */
    variantId: z.string().nullable(),
    problems: z.array(KitCheckProblem),
});

export type KitCheckHeldItem = z.infer<typeof KitCheckHeldItem>;

// The member's answer: a `FormInstance`'s `formData`, and a request's `submittedData`

/**
 * The member's answer for one held item or one missing template. `has` is Yes, No, Not sure, or
 * not yet answered. Not sure asks nothing more, and is neither a need nor a held item. The demo's
 * "Using my own" isn't offered (decision 4), so a save carrying it is refused.
 */
export const KitCheckAnswerData = z.object({
    has: z.enum(["yes", "no", "unsure"]).nullable(),
    /** has = yes: the serial, when the record lacks one (or none is recorded). */
    serial: z.string().max(KIT_CHECK_SERIAL_MAX),
    /** has = yes: the variant they hold, when the record doesn't say (or none is recorded). */
    variantId: idSchema,
    /** has = yes: they asked for a replacement. */
    replace: z.boolean(),
    /** replace: the same variant again, or a different one. */
    replaceWith: z.enum(["same", "different"]).nullable(),
    /** The variant they want (replace = different, or has = no), or `NOT_NEEDED` when has = no. */
    wantVariantId: idSchema,
    /** The size of the one they want, when the template is sized. */
    size: z.string().max(KIT_CHECK_SIZE_MAX),
    notes: z.string().max(KIT_CHECK_NOTES_MAX),
});

export type KitCheckAnswerData = z.infer<typeof KitCheckAnswerData>;

/** Something the member has or needs that isn't on the list. */
export const KitCheckExtraItem = z.object({
    id: idSchema,
    item: z.string().max(KIT_CHECK_ITEM_MAX),
    kind: z.enum(["have", "need"]).nullable(),
    size: z.string().max(KIT_CHECK_SIZE_MAX),
    notes: z.string().max(KIT_CHECK_NOTES_MAX),
});

export type KitCheckExtraItem = z.infer<typeof KitCheckExtraItem>;

/** A member's whole answer, as saved and submitted. */
export const KitCheckResponseData = z.object({
    /** Keyed by held item id (the D4H item id). */
    held: cappedRecord(KitCheckAnswerData, KIT_CHECK_ANSWERS_MAX),
    /** Keyed by template id, for the bundle's templates D4H records nothing of. */
    missing: cappedRecord(KitCheckAnswerData, KIT_CHECK_ANSWERS_MAX),
    extras: z.array(KitCheckExtraItem).max(KIT_CHECK_EXTRAS_MAX),
    comments: z.string().max(KIT_CHECK_COMMENTS_MAX),
});

export type KitCheckResponseData = z.infer<typeof KitCheckResponseData>;
