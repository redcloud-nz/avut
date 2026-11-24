/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * The shapes the kit-check member form reads and produces. A kit check walks one member through
 * an I3 bundle in two parts: the items D4H records as issued to them (do they still have each
 * one, and does its record need fixing?), and the bundle's items D4H has nothing for (do they
 * have one anyway?). Either way they can ask for a new one, in a chosen variant. The demo
 * (`/forms/kit-check/demo`) fills these from sample data; the emailed per-member form fills
 * them from the bundle and D4H.
 */

/** A brand/model a template allows: one of its I3 variants. */
export type KitCheckVariant = { id: string; label: string };

/** A bundle line: an I3 template. */
export type KitCheckTemplate = {
    id: string;
    category: string;
    name: string;
    /** Empty when the template doesn't restrict brand/model. */
    variants: KitCheckVariant[];
    /** Whether an item of this template must have a serial number. */
    requireSN: boolean;
    /**
     * Only some members hold it (keys, access cards): a "thing you might have". Not having one
     * asks nothing more, and it isn't something they need.
     */
    optional?: boolean;
    /** Members may answer "Using my own" instead of holding a team-issued one. */
    allowOwn?: boolean;
    /** The sizes to pick from for a new one; free text when `sized` and empty. */
    sized: boolean;
    /** The member may leave the size blank (templates don't record sizes yet). */
    sizeOptional?: boolean;
    sizeOptions: string[];
    /** Shown in a free-text size field, e.g. "EU size". */
    sizeHint?: string;
};

/** What a held item's D4H record is missing, which the member is asked to fill in. */
export type KitCheckProblem = "serial" | "variant";

/** An item D4H records as issued to the member. */
export type KitCheckHeldItem = {
    id: string;
    templateId: string;
    /** Brand and model, or the D4H ref for keys and cards. */
    description: string;
    serial: string | null;
    /** The variant the record matches, when it matches one. */
    variantId: string | null;
    problems: KitCheckProblem[];
};

export type YesNo = "yes" | "no";

/** The Have answer: Yes, No, or using their own instead of team-issued kit. */
export type HaveAnswer = YesNo | "own";

/** The variant id the member picks when none of the template's variants fits. */
export const OTHER_VARIANT = "other";
/** The "want" choice of a member who has none and doesn't need one. */
export const NOT_NEEDED = "not-needed";

/** The member's answer for one held item or one missing template. */
export type KitCheckAnswer = {
    /** "own": they use their own instead, so nothing more is asked and nothing is needed. */
    has: HaveAnswer | null;
    /** has = yes: the serial, when the record lacks one (or none is recorded). */
    serial: string;
    /** has = yes: the variant they hold, when the record doesn't say (or none is recorded). */
    variantId: string;
    /** has = yes: they asked for a replacement. */
    replace: boolean;
    /** replace: the same variant again, or a different one. */
    replaceWith: "same" | "different" | null;
    /** The variant they want (replace = different, or has = no), or `NOT_NEEDED` when has = no. */
    wantVariantId: string;
    /** The size of the one they want, when the template is sized. */
    size: string;
    notes: string;
};

/** Something the member has or needs that isn't on the list. */
export type KitCheckExtraItem = {
    id: string;
    item: string;
    kind: "have" | "need" | null;
    size: string;
    notes: string;
};

/** An item the team is considering buying, to gauge interest (not an I3 template yet). */
export type KitCheckProposal = {
    id: string;
    name: string;
    description: string;
    /**
     * The fits an interested member picks from, each with its sizes (e.g. Men's S–5XL, Ladies'
     * S–2XL). One fit asks only the size; none asks no size at all.
     */
    fits: KitCheckProposalFit[];
};

export type KitCheckProposalFit = {
    id: string;
    label: string;
    sizes: {
        size: string;
        /** Garment half-chest, from the maker's size chart. */ halfChestCm?: number;
    }[];
};

export type KitCheckProposalAnswer = {
    interest: "yes" | "no" | "unsure" | null;
    fit: string;
    size: string;
    notes: string;
};

export type KitCheckResponse = {
    /** Keyed by held item id for the first part, by template id for the second. */
    held: Record<string, KitCheckAnswer>;
    missing: Record<string, KitCheckAnswer>;
    /** Keyed by proposal id. */
    proposals: Record<string, KitCheckProposalAnswer>;
    extras: KitCheckExtraItem[];
    comments: string;
};

export type KitCheckSubject = {
    memberName: string;
    teamName: string;
    bundleName: string;
    /** Who asked, named in the intro. */
    requestedBy: string;
};
