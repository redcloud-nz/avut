/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Judge an issued D4H item against an I3 template's data-quality rules: its serial requirement,
 * its Brand & Model rule and the brand/model pairs of its D4H variants. Pure and structurally
 * typed, so it takes `d4hApi.listTeamIssuedEquipment` items, `i3.listTemplates` templates and
 * `i3Bundles.getBundle` lines alike. See `docs/plans/2026-11-19-i3-data-quality.md`, "The states".
 */

/** How an item fares against a template, from best to worst. */
export type ItemQualityState = "ok" | "incomplete" | "mismatch";

/** The rules one template sets for its items. `I3BundleLine.template` carries the same shape. */
export type ItemQualityRules = {
    requireSN: boolean;
    brandModelRule: "Required" | "Optional" | "None";
    /** The brand/model pairs of the template's variants that have D4H records. */
    variants: readonly { brandId: number; modelId: number }[];
};

/** A part of the item's D4H record that the template requires and the item leaves blank. */
export type ItemQualityMissingPart = "brand" | "model" | "serial";

export type ItemQualityResult = {
    state: ItemQualityState;
    /** The blank required parts, brand before model before serial. Empty unless `incomplete`. */
    missing: ItemQualityMissingPart[];
    /** Why the item doesn't match. `null` unless `mismatch`. */
    mismatch: "not-a-variant" | "should-be-blank" | null;
};

/** An issued item, as far as the check reads it (`listTeamIssuedEquipment` items fit). */
export type ItemQualityItem = {
    serial: string | null;
    brand: { id: number | null };
    model: { id: number | null } | null;
};

/** A template, as far as the rules read it (`listTemplates` output fits). */
export type ItemQualityTemplate = {
    d4h: { requireSN: boolean; brandModelRule: ItemQualityRules["brandModelRule"] } | null;
    variants: readonly { d4h: { brandId: number; modelId: number } | null }[];
};

/**
 * The rules of a template shaped like `listTemplates` output, or `null` when it has no D4H type.
 * Variants without D4H records are left out.
 */
export function qualityRulesForTemplate(template: ItemQualityTemplate): ItemQualityRules | null {
    if (template.d4h === null) return null;
    return {
        requireSN: template.d4h.requireSN,
        brandModelRule: template.d4h.brandModelRule,
        variants: template.variants.flatMap((variant) =>
            variant.d4h === null
                ? []
                : [{ brandId: variant.d4h.brandId, modelId: variant.d4h.modelId }],
        ),
    };
}

/**
 * Judge one item against one template's rules.
 *
 * - **Incomplete** when a required part is blank: the serial (when `requireSN`; whitespace counts
 *   as blank), or the brand or model (when the rule is Required).
 * - Otherwise **Doesn't match** when the rule is None and a brand or model is set
 *   (`should-be-blank`), or when the template has D4H variants and the item's brand (with its
 *   model, if set) isn't one of theirs (`not-a-variant`). A None template ignores its variants;
 *   an item with no brand has nothing to match.
 * - Otherwise **OK**.
 */
export function checkItemQuality(
    item: ItemQualityItem,
    rules: ItemQualityRules,
): ItemQualityResult {
    const brandId = item.brand.id;
    const modelId = item.model?.id ?? null;

    const missing: ItemQualityMissingPart[] = [];
    if (rules.brandModelRule === "Required") {
        if (brandId === null) missing.push("brand");
        if (modelId === null) missing.push("model");
    }
    if (rules.requireSN && (item.serial === null || item.serial.trim() === "")) {
        missing.push("serial");
    }
    if (missing.length > 0) return { state: "incomplete", missing, mismatch: null };

    if (rules.brandModelRule === "None") {
        if (brandId !== null || modelId !== null) {
            return { state: "mismatch", missing: [], mismatch: "should-be-blank" };
        }
        return { state: "ok", missing: [], mismatch: null };
    }

    if (rules.variants.length > 0 && brandId !== null) {
        const accepted =
            modelId === null
                ? rules.variants.some((variant) => variant.brandId === brandId)
                : rules.variants.some(
                      (variant) => variant.brandId === brandId && variant.modelId === modelId,
                  );
        if (!accepted) return { state: "mismatch", missing: [], mismatch: "not-a-variant" };
    }

    return { state: "ok", missing: [], mismatch: null };
}

const STATE_RANK: Record<ItemQualityState, number> = { ok: 0, mismatch: 1, incomplete: 2 };

/**
 * The best of several results (OK < mismatch < incomplete), or `null` for none. Issued Types
 * judges an item against every Active template of its type and keeps the best.
 */
export function bestQuality(results: readonly ItemQualityResult[]): ItemQualityResult | null {
    return results.reduce<ItemQualityResult | null>(
        (best, result) =>
            best === null || STATE_RANK[result.state] < STATE_RANK[best.state] ? result : best,
        null,
    );
}

/**
 * The worst of several results (OK < mismatch < incomplete), or `null` for none. A bundle cell
 * takes the worst of its items, so one bad record isn't hidden behind a good one.
 */
export function worstQuality(results: readonly ItemQualityResult[]): ItemQualityResult | null {
    return results.reduce<ItemQualityResult | null>(
        (worst, result) =>
            worst === null || STATE_RANK[result.state] > STATE_RANK[worst.state] ? result : worst,
        null,
    );
}

const PART_ORDER: readonly ItemQualityMissingPart[] = ["brand", "model", "serial"];
const PART_LABEL: Record<ItemQualityMissingPart, string> = {
    brand: "brand",
    model: "model",
    serial: "serial number",
};

/**
 * The missing parts as a label: "No model", "No brand or model", "No brand, model or serial
 * number". Brand before model before serial. Empty for no missing parts.
 */
export function missingPartsLabel(missing: readonly ItemQualityMissingPart[]): string {
    const parts = PART_ORDER.filter((part) => missing.includes(part)).map(
        (part) => PART_LABEL[part],
    );
    if (parts.length === 0) return "";
    if (parts.length === 1) return `No ${parts[0]}`;
    return `No ${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
}
