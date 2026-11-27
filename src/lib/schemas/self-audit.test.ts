/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import type { SelfAuditResponse } from "@/lib/self-audit-types";
import { NOT_NEEDED } from "@/lib/self-audit-types";
import { EMPTY_ANSWER } from "@/lib/self-audit-validate";

import {
    SELF_AUDIT_ANSWERS_MAX,
    SELF_AUDIT_COMMENTS_MAX,
    SELF_AUDIT_EXTRAS_MAX,
    SELF_AUDIT_NOTES_MAX,
    SelfAuditHeldItem,
    SelfAuditResponseData,
    SelfAuditTemplate,
    SelfAuditTemplatesByTeam,
} from "./self-audit";

/** An answer as the stage-1 form produces it, proposals included. */
const stageOneResponse: SelfAuditResponse = {
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

describe("SelfAuditResponseData", () => {
    it("parses a stage-1-shaped answer, dropping the proposals", () => {
        const { proposals: _proposals, ...expected } = stageOneResponse;
        expect(SelfAuditResponseData.parse(stageOneResponse)).toEqual(expected);
    });

    it('accepts has: "unsure"', () => {
        const response = {
            ...stageOneResponse,
            held: { "d4h-1": { ...EMPTY_ANSWER, has: "unsure", notes: "Lent it out" } },
        };
        expect(SelfAuditResponseData.parse(response).held["d4h-1"].has).toBe("unsure");
    });

    it('rejects has: "own"', () => {
        const response = {
            ...stageOneResponse,
            held: { "d4h-1": { ...EMPTY_ANSWER, has: "own" } },
        };
        expect(SelfAuditResponseData.safeParse(response).success).toBe(false);
    });

    it("rejects an oversized string", () => {
        const response = { ...stageOneResponse, comments: "x".repeat(SELF_AUDIT_COMMENTS_MAX + 1) };
        expect(SelfAuditResponseData.safeParse(response).success).toBe(false);

        const notes = {
            ...stageOneResponse,
            missing: { helmet: { ...EMPTY_ANSWER, notes: "x".repeat(SELF_AUDIT_NOTES_MAX + 1) } },
        };
        expect(SelfAuditResponseData.safeParse(notes).success).toBe(false);
    });

    it("rejects too many answers or extra rows", () => {
        const held = Object.fromEntries(
            Array.from({ length: SELF_AUDIT_ANSWERS_MAX + 1 }, (_, i) => [
                `d4h-${i}`,
                EMPTY_ANSWER,
            ]),
        );
        expect(SelfAuditResponseData.safeParse({ ...stageOneResponse, held }).success).toBe(false);

        const extras = Array.from({ length: SELF_AUDIT_EXTRAS_MAX + 1 }, (_, i) => ({
            ...stageOneResponse.extras[0],
            id: `e${i}`,
        }));
        expect(SelfAuditResponseData.safeParse({ ...stageOneResponse, extras }).success).toBe(
            false,
        );
    });

    it("rejects an oversized record key", () => {
        const held = { ["k".repeat(101)]: EMPTY_ANSWER };
        expect(SelfAuditResponseData.safeParse({ ...stageOneResponse, held }).success).toBe(false);
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
        expect(SelfAuditTemplate.parse(harness)).toEqual(harness);
        const gloves = { ...harness, variants: [], requireSN: false, sized: true };
        expect(SelfAuditTemplate.parse(gloves)).toEqual(gloves);
    });

    it("parse templates keyed by D4H team id, and reject any other key", () => {
        const helmet = {
            id: "helmet",
            category: "PPE",
            name: "Helmet",
            variants: [],
            requireSN: false,
            sized: true,
            sizeOptional: true,
            sizeOptions: [],
        };
        const byTeam = { "7": [helmet], "8": [] };
        expect(SelfAuditTemplatesByTeam.parse(byTeam)).toEqual(byTeam);
        expect(SelfAuditTemplatesByTeam.safeParse({ rescue: [helmet] }).success).toBe(false);
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
        expect(SelfAuditHeldItem.parse(item)).toEqual(item);
        expect(SelfAuditHeldItem.safeParse({ ...item, problems: ["other"] }).success).toBe(false);
    });
});
