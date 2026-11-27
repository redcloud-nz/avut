/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * The shapes the self-audit member form reads and produces. A self-audit walks one member through
 * an I3 bundle in two parts: the items D4H records as issued to them (do they still have each
 * one, and does its record need fixing?), and the bundle's items D4H has nothing for (do they
 * have one anyway?). Either way they can ask for a new one, in a chosen variant. The demo
 * (`/forms/kit-check/demo`) fills these from sample data; the emailed per-member form fills
 * them from the bundle and D4H.
 *
 * The stored shapes are defined once, as Zod schemas in `src/lib/schemas/self-audit.ts`. The
 * types here are those, plus the demo-only extras the emailed form doesn't send (yet): "Using my
 * own", "things you might have" and considered items (proposals), all optional.
 */

import type {
    SelfAuditAnswerData,
    SelfAuditResponseData,
    SelfAuditTemplate as SelfAuditTemplateData,
} from "@/lib/schemas/self-audit";

export type {
    SelfAuditExtraItem,
    SelfAuditHeldItem,
    SelfAuditProblem,
    SelfAuditVariant,
} from "@/lib/schemas/self-audit";

/** A bundle line: an I3 template. */
export type SelfAuditTemplate = SelfAuditTemplateData & {
    /**
     * Demo only. Only some members hold it (keys, access cards): a "thing you might have". Not
     * having one asks nothing more, and it isn't something they need.
     */
    optional?: boolean;
    /** Demo only. Members may answer "Using my own" instead of holding a team-issued one. */
    allowOwn?: boolean;
};

export type YesNo = "yes" | "no";

/**
 * The Have answer: Yes, No, Not sure, or (demo only) using their own instead of team-issued kit.
 */
export type HaveAnswer = YesNo | "unsure" | "own";

/** The variant id the member picks when none of the template's variants fits. */
export const OTHER_VARIANT = "other";
/** The "want" choice of a member who has none and doesn't need one. */
export const NOT_NEEDED = "not-needed";

/**
 * The member's answer for one held item or one missing template. `has` adds the demo's "own":
 * they use their own instead, so nothing more is asked and nothing is needed.
 */
export type SelfAuditAnswer = Omit<SelfAuditAnswerData, "has"> & { has: HaveAnswer | null };

/** An item the team is considering buying, to gauge interest (not an I3 template yet). */
export type SelfAuditProposal = {
    id: string;
    name: string;
    description: string;
    /**
     * The fits an interested member picks from, each with its sizes (e.g. Men's S–5XL, Ladies'
     * S–2XL). One fit asks only the size; none asks no size at all.
     */
    fits: SelfAuditProposalFit[];
};

export type SelfAuditProposalFit = {
    id: string;
    label: string;
    sizes: {
        size: string;
        /** Garment half-chest, from the maker's size chart. */ halfChestCm?: number;
    }[];
};

export type SelfAuditProposalAnswer = {
    interest: "yes" | "no" | "unsure" | null;
    fit: string;
    size: string;
    notes: string;
};

export type SelfAuditResponse = Omit<SelfAuditResponseData, "held" | "missing"> & {
    /** Keyed by held item id for the first part, by template id for the second. */
    held: Record<string, SelfAuditAnswer>;
    missing: Record<string, SelfAuditAnswer>;
    /** Demo only. Keyed by proposal id. */
    proposals?: Record<string, SelfAuditProposalAnswer>;
};

export type SelfAuditSubject = {
    memberName: string;
    teamName: string;
    bundleName: string;
    /** Who asked, named in the intro. */
    requestedBy: string;
};
