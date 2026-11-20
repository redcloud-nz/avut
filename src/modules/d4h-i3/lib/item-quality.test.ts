/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import {
    bestQuality,
    checkItemQuality,
    missingPartsLabel,
    qualityRulesForTemplate,
    worstQuality,
    type ItemQualityItem,
    type ItemQualityResult,
    type ItemQualityRules,
} from "./item-quality";

const BRAND_ACME = 10;
const BRAND_BOLT = 20;
const MODEL_ACME_1 = 11;
const MODEL_ACME_2 = 12;
const MODEL_BOLT_1 = 21;

function item(
    brandId: number | null,
    modelId: number | null | undefined,
    serial: string | null = "SN-1",
): ItemQualityItem {
    return {
        serial,
        brand: { id: brandId },
        model: modelId === undefined ? null : { id: modelId },
    };
}

function rules(overrides: Partial<ItemQualityRules> = {}): ItemQualityRules {
    return {
        requireSN: false,
        brandModelRule: "Optional",
        variants: [
            { brandId: BRAND_ACME, modelId: MODEL_ACME_1 },
            { brandId: BRAND_ACME, modelId: MODEL_ACME_2 },
        ],
        ...overrides,
    };
}

const OK: ItemQualityResult = { state: "ok", missing: [], mismatch: null };
const NOT_A_VARIANT: ItemQualityResult = {
    state: "mismatch",
    missing: [],
    mismatch: "not-a-variant",
};
const SHOULD_BE_BLANK: ItemQualityResult = {
    state: "mismatch",
    missing: [],
    mismatch: "should-be-blank",
};
const incomplete = (...missing: ItemQualityResult["missing"]): ItemQualityResult => ({
    state: "incomplete",
    missing,
    mismatch: null,
});

describe("checkItemQuality", () => {
    describe("serial", () => {
        it("is incomplete when required and null", () => {
            expect(
                checkItemQuality(item(null, undefined, null), rules({ requireSN: true })),
            ).toEqual(incomplete("serial"));
        });

        it("is incomplete when required and whitespace", () => {
            expect(
                checkItemQuality(item(null, undefined, "  "), rules({ requireSN: true })),
            ).toEqual(incomplete("serial"));
        });

        it("is ok when required and set", () => {
            expect(
                checkItemQuality(item(null, undefined, "SN-9"), rules({ requireSN: true })),
            ).toEqual(OK);
        });

        it("is ignored when not required", () => {
            expect(checkItemQuality(item(null, undefined, null), rules())).toEqual(OK);
        });
    });

    describe("Required", () => {
        const required = rules({ brandModelRule: "Required" });

        it("is incomplete with the model blank", () => {
            expect(checkItemQuality(item(BRAND_ACME, undefined), required)).toEqual(
                incomplete("model"),
            );
            expect(checkItemQuality(item(BRAND_ACME, null), required)).toEqual(incomplete("model"));
        });

        it("is incomplete with the brand blank", () => {
            expect(checkItemQuality(item(null, MODEL_ACME_1), required)).toEqual(
                incomplete("brand"),
            );
        });

        it("is incomplete with both blank", () => {
            expect(checkItemQuality(item(null, undefined), required)).toEqual(
                incomplete("brand", "model"),
            );
        });

        it("reports every missing part, serial last", () => {
            expect(
                checkItemQuality(
                    item(null, undefined, null),
                    rules({ brandModelRule: "Required", requireSN: true }),
                ),
            ).toEqual(incomplete("brand", "model", "serial"));
        });

        it("is ok with a variant's pair", () => {
            expect(checkItemQuality(item(BRAND_ACME, MODEL_ACME_2), required)).toEqual(OK);
        });

        it("doesn't match with a pair that no variant has", () => {
            expect(checkItemQuality(item(BRAND_BOLT, MODEL_BOLT_1), required)).toEqual(
                NOT_A_VARIANT,
            );
        });
    });

    describe("variant match", () => {
        it("doesn't match by pair: a variant's brand with another brand's model", () => {
            expect(checkItemQuality(item(BRAND_ACME, MODEL_BOLT_1), rules())).toEqual(
                NOT_A_VARIANT,
            );
        });

        it("doesn't match by brand only on an Optional template", () => {
            expect(checkItemQuality(item(BRAND_BOLT, undefined), rules())).toEqual(NOT_A_VARIANT);
        });

        it("is ok by brand only when some variant has the brand", () => {
            expect(checkItemQuality(item(BRAND_ACME, undefined), rules())).toEqual(OK);
        });

        it("is ok with no brand on an Optional template", () => {
            expect(checkItemQuality(item(null, undefined), rules())).toEqual(OK);
        });

        it("is skipped when the template has no D4H variants", () => {
            expect(
                checkItemQuality(item(BRAND_BOLT, MODEL_BOLT_1), rules({ variants: [] })),
            ).toEqual(OK);
            expect(
                checkItemQuality(
                    item(BRAND_BOLT, MODEL_BOLT_1),
                    rules({ brandModelRule: "Required", variants: [] }),
                ),
            ).toEqual(OK);
        });
    });

    describe("None", () => {
        const none = rules({ brandModelRule: "None" });

        it("is ok with both blank, even with variants", () => {
            expect(none.variants.length).toBeGreaterThan(0);
            expect(checkItemQuality(item(null, undefined), none)).toEqual(OK);
            expect(checkItemQuality(item(null, null), none)).toEqual(OK);
        });

        it("doesn't match with a brand set, even a variant's", () => {
            expect(checkItemQuality(item(BRAND_ACME, undefined), none)).toEqual(SHOULD_BE_BLANK);
            expect(checkItemQuality(item(BRAND_ACME, MODEL_ACME_1), none)).toEqual(SHOULD_BE_BLANK);
        });

        it("doesn't match with a model set", () => {
            expect(checkItemQuality(item(null, MODEL_ACME_1), none)).toEqual(SHOULD_BE_BLANK);
        });

        it("is incomplete with a blank required serial", () => {
            expect(
                checkItemQuality(
                    item(BRAND_ACME, MODEL_ACME_1, null),
                    rules({ brandModelRule: "None", requireSN: true }),
                ),
            ).toEqual(incomplete("serial"));
        });
    });

    it("prefers incomplete over mismatch", () => {
        expect(
            checkItemQuality(item(BRAND_BOLT, MODEL_BOLT_1, " "), rules({ requireSN: true })),
        ).toEqual(incomplete("serial"));
        expect(
            checkItemQuality(item(BRAND_BOLT, undefined), rules({ brandModelRule: "Required" })),
        ).toEqual(incomplete("model"));
    });
});

describe("qualityRulesForTemplate", () => {
    it("is null without a D4H type", () => {
        expect(qualityRulesForTemplate({ d4h: null, variants: [] })).toBeNull();
    });

    it("keeps only the variants with D4H records", () => {
        expect(
            qualityRulesForTemplate({
                d4h: { requireSN: true, brandModelRule: "Required" },
                variants: [
                    { d4h: { brandId: BRAND_ACME, modelId: MODEL_ACME_1 } },
                    { d4h: null },
                    { d4h: { brandId: BRAND_BOLT, modelId: MODEL_BOLT_1 } },
                ],
            }),
        ).toEqual({
            requireSN: true,
            brandModelRule: "Required",
            variants: [
                { brandId: BRAND_ACME, modelId: MODEL_ACME_1 },
                { brandId: BRAND_BOLT, modelId: MODEL_BOLT_1 },
            ],
        });
    });
});

describe("bestQuality / worstQuality", () => {
    const all = [NOT_A_VARIANT, incomplete("model"), OK];

    it("are null for no results", () => {
        expect(bestQuality([])).toBeNull();
        expect(worstQuality([])).toBeNull();
    });

    it("order ok < mismatch < incomplete", () => {
        expect(bestQuality(all)).toEqual(OK);
        expect(worstQuality(all)).toEqual(incomplete("model"));
        expect(bestQuality([incomplete("serial"), SHOULD_BE_BLANK])).toEqual(SHOULD_BE_BLANK);
        expect(worstQuality([OK, SHOULD_BE_BLANK])).toEqual(SHOULD_BE_BLANK);
    });
});

describe("missingPartsLabel", () => {
    it.each([
        [["model"], "No model"],
        [["brand"], "No brand"],
        [["serial"], "No serial number"],
        [["brand", "model"], "No brand or model"],
        [["model", "serial"], "No model or serial number"],
        [["serial", "model", "brand"], "No brand, model or serial number"],
        [[], ""],
    ] as const)("labels %j as %j", (missing, label) => {
        expect(missingPartsLabel(missing)).toBe(label);
    });
});
