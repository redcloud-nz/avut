/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import type { KitCheckHeldItem, KitCheckTemplate } from "@/lib/kit-check-types";
import { NOT_NEEDED } from "@/lib/kit-check-types";

import {
    answerErrors,
    EMPTY_ANSWER,
    EMPTY_PROPOSAL_ANSWER,
    proposalErrors,
    wantsOne,
} from "./kit-check-validate";

const harness: KitCheckTemplate = {
    id: "harness",
    category: "Rope",
    name: "Harness",
    variants: [
        { id: "avao", label: "Petzl Avao Bod" },
        { id: "falcon", label: "Petzl Falcon" },
    ],
    requireSN: true,
    sized: true,
    sizeOptions: ["0", "1", "2"],
};

const heldNoSerial: KitCheckHeldItem = {
    id: "h1",
    templateId: "harness",
    description: "Petzl Avao Bod",
    serial: null,
    variantId: "avao",
    problems: ["serial"],
};

const heldComplete: KitCheckHeldItem = { ...heldNoSerial, serial: "X1", problems: [] };

describe("answerErrors", () => {
    it("asks for Have first", () => {
        expect(Object.keys(answerErrors(EMPTY_ANSWER, harness, heldComplete))).toEqual(["has"]);
    });

    it("asks a held item only for what its record lacks", () => {
        const answer = { ...EMPTY_ANSWER, has: "yes" as const };
        expect(answerErrors(answer, harness, heldComplete)).toEqual({});
        expect(Object.keys(answerErrors(answer, harness, heldNoSerial))).toEqual(["serial"]);
    });

    it("asks an unrecorded item for its variant and serial", () => {
        const answer = { ...EMPTY_ANSWER, has: "yes" as const };
        expect(Object.keys(answerErrors(answer, harness, null)).sort()).toEqual([
            "serial",
            "variantId",
        ]);
    });

    it("asks a replacement for same-or-different, a variant when different, and a size", () => {
        const base = { ...EMPTY_ANSWER, has: "yes" as const, replace: true };
        expect(Object.keys(answerErrors(base, harness, heldComplete))).toEqual(["replaceWith"]);
        expect(
            Object.keys(answerErrors({ ...base, replaceWith: "same" }, harness, heldComplete)),
        ).toEqual(["size"]);
        expect(
            Object.keys(
                answerErrors({ ...base, replaceWith: "different" }, harness, heldComplete),
            ).sort(),
        ).toEqual(["size", "wantVariantId"]);
    });

    it("asks a No for the variant they want, and a size unless they need none", () => {
        const no = { ...EMPTY_ANSWER, has: "no" as const };
        expect(Object.keys(answerErrors(no, harness, heldComplete))).toEqual(["wantVariantId"]);
        expect(
            Object.keys(answerErrors({ ...no, wantVariantId: "falcon" }, harness, heldComplete)),
        ).toEqual(["size"]);
        expect(answerErrors({ ...no, wantVariantId: NOT_NEEDED }, harness, heldComplete)).toEqual(
            {},
        );
    });
});

describe("a template with no variants", () => {
    const lamp = { ...harness, variants: [], requireSN: false, sized: false };
    const heldLamp = {
        ...heldComplete,
        templateId: "lamp",
        variantId: null,
        problems: ["variant" as const],
    };

    it("asks a replacement nothing more: there's nothing to differ by", () => {
        const answer = { ...EMPTY_ANSWER, has: "yes" as const, replace: true };
        expect(answerErrors(answer, lamp, heldComplete)).toEqual({});
    });

    it("doesn't ask which one they hold, even when the record lacks a brand/model", () => {
        expect(answerErrors({ ...EMPTY_ANSWER, has: "yes" }, lamp, heldLamp)).toEqual({});
    });
});

describe("an optional item", () => {
    const key = { ...harness, optional: true };

    it("asks nothing more of a No, held or not", () => {
        const no = { ...EMPTY_ANSWER, has: "no" as const };
        expect(answerErrors(no, key, null)).toEqual({});
        expect(answerErrors(no, key, heldComplete)).toEqual({});
        expect(wantsOne(no)).toBe(false);
    });

    it("asks a Yes for its details like any other item", () => {
        const yes = { ...EMPTY_ANSWER, has: "yes" as const };
        expect(Object.keys(answerErrors(yes, key, null)).sort()).toEqual(["serial", "variantId"]);
    });
});

describe("using their own", () => {
    it("asks nothing more, and needs nothing", () => {
        const own = { ...EMPTY_ANSWER, has: "own" as const };
        expect(answerErrors(own, harness, heldNoSerial)).toEqual({});
        expect(answerErrors(own, harness, null)).toEqual({});
        expect(wantsOne(own)).toBe(false);
    });
});

describe("wantsOne", () => {
    it("is a replacement, or a No that names a variant", () => {
        expect(wantsOne({ ...EMPTY_ANSWER, has: "yes", replace: true })).toBe(true);
        expect(wantsOne({ ...EMPTY_ANSWER, has: "no", wantVariantId: "avao" })).toBe(true);
        expect(wantsOne({ ...EMPTY_ANSWER, has: "no", wantVariantId: NOT_NEEDED })).toBe(false);
        expect(wantsOne({ ...EMPTY_ANSWER, has: "yes" })).toBe(false);
    });
});

describe("proposalErrors", () => {
    const fit = (id: string) => ({ id, label: id, sizes: [{ size: "M" }, { size: "L" }] });
    const twoFits = {
        id: "s",
        name: "Soft shell",
        description: "",
        fits: [fit("mens"), fit("ladies")],
    };
    const oneFit = { ...twoFits, fits: [fit("unisex")] };
    const yes = { ...EMPTY_PROPOSAL_ANSWER, interest: "yes" as const };

    it("asks whether they'd use one, and nothing more unless they would", () => {
        expect(Object.keys(proposalErrors(EMPTY_PROPOSAL_ANSWER, twoFits))).toEqual(["interest"]);
        const unsure = { ...EMPTY_PROPOSAL_ANSWER, interest: "unsure" as const };
        expect(proposalErrors(unsure, twoFits)).toEqual({});
    });

    it("asks a Yes for the fit when there's a choice, then a size", () => {
        expect(Object.keys(proposalErrors(yes, twoFits))).toEqual(["fit"]);
        expect(Object.keys(proposalErrors({ ...yes, fit: "ladies" }, twoFits))).toEqual(["size"]);
        expect(proposalErrors({ ...yes, fit: "ladies", size: "M" }, twoFits)).toEqual({});
    });

    it("skips the fit when there's only one", () => {
        expect(Object.keys(proposalErrors(yes, oneFit))).toEqual(["size"]);
    });
});
