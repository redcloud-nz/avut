/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { J307_JACKET, JACKET_TEAMS } from "@/lib/j307-jacket";

export const JACKET_INTEREST_CHOICES = ["yes", "no", "unsure"] as const;

/** The longest name and comment the form takes; the page enforces them too. */
export const JACKET_NAME_MAX = 100;
export const JACKET_NOTES_MAX = 1000;

/**
 * An answer's shape as stored in the `FormInstance`'s `formData`. Stored answers are read back
 * with this alone, not `JacketInterestData`'s team and size checks, so editing the team or size
 * lists later never hides an earlier answer.
 */
export const JacketInterestStored = z.object({
    team: z.string(),
    name: z.string(),
    interest: z.enum(JACKET_INTEREST_CHOICES),
    fit: z.string(),
    size: z.string(),
    notes: z.string(),
});

export type JacketInterestStored = z.infer<typeof JacketInterestStored>;

/**
 * One answer to the soft shell jacket interest form (`/forms/chch-soft-shell-jacket`), as sent.
 * A Yes must name a fit and one of that fit's sizes; otherwise fit and size are blanked.
 */
export const JacketInterestData = z
    .object({
        team: z.enum(JACKET_TEAMS),
        name: z.string().trim().min(1, "Please give your name.").max(JACKET_NAME_MAX),
        interest: z.enum(JACKET_INTEREST_CHOICES),
        fit: z.string().max(20),
        size: z.string().max(10),
        notes: z.string().trim().max(JACKET_NOTES_MAX),
    })
    .superRefine((value, ctx) => {
        if (value.interest !== "yes") return;
        const fit = J307_JACKET.fits.find((f) => f.id === value.fit);
        if (!fit) {
            ctx.addIssue({ code: "custom", path: ["fit"], message: "Please pick a fit." });
            return;
        }
        if (!fit.sizes.some(({ size }) => size === value.size)) {
            ctx.addIssue({ code: "custom", path: ["size"], message: "Please give your size." });
        }
    })
    .transform((value) => (value.interest === "yes" ? value : { ...value, fit: "", size: "" }));

export type JacketInterestData = z.infer<typeof JacketInterestData>;

/**
 * What the form sends: the answer, plus `website`, a honeypot people never see. Anything in it
 * marks a bot, and the answer is dropped.
 */
export const JacketInterestSubmission = z.object({
    answer: JacketInterestData,
    website: z.string().max(200),
});

export type JacketInterestSubmission = z.input<typeof JacketInterestSubmission>;

/** A stored answer, as the organisation's admins read it back. */
export const JacketInterestRow = z.object({
    id: z.string(),
    submittedAt: z.iso.datetime(),
    answer: JacketInterestStored,
});

export type JacketInterestRow = z.infer<typeof JacketInterestRow>;
