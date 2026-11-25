/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import type { KitCheckResponse } from "@/lib/kit-check-types";
import { NOT_NEEDED } from "@/lib/kit-check-types";
import { EMPTY_ANSWER } from "@/lib/kit-check-validate";

import {
    KIT_CHECK_ANSWERS_MAX,
    KIT_CHECK_COMMENTS_MAX,
    KIT_CHECK_EXTRAS_MAX,
    KIT_CHECK_NOTES_MAX,
    KitCheckHeldItem,
    KitCheckResponseData,
    KitCheckTemplate,
} from "./kit-check";

/** An answer as the stage-1 form produces it, proposals included. */
const stageOneResponse: KitCheckResponse = {
    held: {
        "d4h-1": { ...EMPTY_ANSWER, has: "yes", serial: "X1" },
        "d4h-2": {
            ...EMPTY_ANSWER,
            has: "yes",
            replace: true,
            replaceWith: "different",
            wantVariantId: "falcon",
            size: "2",
        },
    },
    missing: {
        helmet: { ...EMPTY_ANSWER, has: "no", wantVariantId: NOT_NEEDED },
        gloves: { ...EMPTY_ANSWER, has: null },
    },
    proposals: {
        "soft-shell-jacket": { interest: "yes", fit: "mens", size: "L", notes: "" },
    },
    extras: [{ id: "e1", item: "Head torch", kind: "need", size: "", notes: "" }],
    comments: "All good.",
};

describe("KitCheckResponseData", () => {
    it("parses a stage-1-shaped answer, dropping the proposals", () => {
        const { proposals: _proposals, ...expected } = stageOneResponse;
        expect(KitCheckResponseData.parse(stageOneResponse)).toEqual(expected);
    });

    it('rejects has: "own"', () => {
        const response = {
            ...stageOneResponse,
            held: { "d4h-1": { ...EMPTY_ANSWER, has: "own" } },
        };
        expect(KitCheckResponseData.safeParse(response).success).toBe(false);
    });

    it("rejects an oversized string", () => {
        const response = { ...stageOneResponse, comments: "x".repeat(KIT_CHECK_COMMENTS_MAX + 1) };
        expect(KitCheckResponseData.safeParse(response).success).toBe(false);

        const notes = {
            ...stageOneResponse,
            missing: { helmet: { ...EMPTY_ANSWER, notes: "x".repeat(KIT_CHECK_NOTES_MAX + 1) } },
        };
        expect(KitCheckResponseData.safeParse(notes).success).toBe(false);
    });

    it("rejects too many answers or extra rows", () => {
        const held = Object.fromEntries(
            Array.from({ length: KIT_CHECK_ANSWERS_MAX + 1 }, (_, i) => [`d4h-${i}`, EMPTY_ANSWER]),
        );
        expect(KitCheckResponseData.safeParse({ ...stageOneResponse, held }).success).toBe(false);

        const extras = Array.from({ length: KIT_CHECK_EXTRAS_MAX + 1 }, (_, i) => ({
            ...stageOneResponse.extras[0],
            id: `e${i}`,
        }));
        expect(KitCheckResponseData.safeParse({ ...stageOneResponse, extras }).success).toBe(false);
    });

    it("rejects an oversized record key", () => {
        const held = { ["k".repeat(101)]: EMPTY_ANSWER };
        expect(KitCheckResponseData.safeParse({ ...stageOneResponse, held }).success).toBe(false);
    });
});

describe("snapshots", () => {
    it("parse a template with and without variants", () => {
        const harness = {
            id: "harness",
            category: "Rope",
            name: "Harness",
            variants: [{ id: "avao", label: "Petzl Avao Bod" }],
            requireSN: true,
            sized: false,
            sizeOptional: true,
            sizeOptions: [],
        };
        expect(KitCheckTemplate.parse(harness)).toEqual(harness);
        const gloves = { ...harness, variants: [], requireSN: false, sized: true };
        expect(KitCheckTemplate.parse(gloves)).toEqual(gloves);
    });

    it("parse a held item and reject an unknown problem", () => {
        const item = {
            id: "123",
            templateId: "harness",
            description: "Petzl Avao Bod",
            serial: null,
            variantId: null,
            problems: ["serial", "variant"],
        };
        expect(KitCheckHeldItem.parse(item)).toEqual(item);
        expect(KitCheckHeldItem.safeParse({ ...item, problems: ["other"] }).success).toBe(false);
    });
});
