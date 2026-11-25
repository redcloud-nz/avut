/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { compareBundle } from "@/lib/i3-bundle-compare";
import { EMPTY_ANSWER } from "@/lib/kit-check-validate";
import type { D4HEquipmentListItem } from "@/lib/schemas/d4h/equipment-item";
import type { I3BundleLine } from "@/lib/schemas/i3-bundle";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { KitCheckResponseData } from "@/lib/schemas/kit-check";

import {
    buildKitCheckSnapshot,
    type KitCheckIssuedItem,
    type KitCheckVariantSource,
} from "./kit-checks";

const TEAM_ID = 7;
const HARNESS_KIND = 100;
const GLOVES_KIND = 200;

const T = {
    harness: I3TemplateId.create(),
    gloves: I3TemplateId.create(),
};

/** A Rope/Harness line: serial required, brand and model required, two D4H variants. */
const harnessLine: I3BundleLine = {
    template: {
        id: T.harness,
        name: "Harness",
        status: "Active",
        d4h: {
            categoryId: 1,
            categoryTitle: "Rope",
            kindId: HARNESS_KIND,
            kindTitle: "Harness",
            requireSN: true,
            brandModelRule: "Required",
        },
        variants: [
            { brandId: 1, modelId: 11 },
            { brandId: 1, modelId: 12 },
        ],
    },
};

/** A PPE/Gloves line with no variants and no serial. */
const glovesLine: I3BundleLine = {
    template: {
        id: T.gloves,
        name: "Gloves",
        status: "Active",
        d4h: {
            categoryId: 2,
            categoryTitle: "PPE",
            kindId: GLOVES_KIND,
            kindTitle: "Gloves",
            requireSN: false,
            brandModelRule: "Optional",
        },
        variants: [],
    },
};

const variants: KitCheckVariantSource[] = [
    { id: "avao", templateId: T.harness, name: "Petzl Avao", d4h: { brandId: 1, modelId: 11 } },
    { id: "falcon", templateId: T.harness, name: "Petzl Falcon", d4h: { brandId: 1, modelId: 12 } },
    // Fits no team: not offered.
    { id: "astro", templateId: T.harness, name: "Petzl Astro", d4h: { brandId: 1, modelId: 13 } },
    // No D4H record: not offered.
    { id: "other", templateId: T.harness, name: "Other harness", d4h: null },
];
const fittingVariantIds = ["avao", "falcon", "other"];

function item(
    id: number,
    holderId: number,
    kindId: number,
    overrides: Partial<D4HEquipmentListItem> = {},
): KitCheckIssuedItem {
    return {
        id,
        ref: String(id).padStart(6, "0"),
        status: "OPERATIONAL",
        serial: null,
        owner: { resourceType: "Team", id: TEAM_ID },
        category: { resourceType: "EquipmentCategory", id: 1 },
        kind: { resourceType: "EquipmentKind", id: kindId, title: "Kind" },
        brand: { resourceType: "EquipmentBrand", id: null },
        model: null,
        notes: "",
        parents: [],
        dateExpires: null,
        dateFirstUse: null,
        dateManufactured: null,
        datePurchased: null,
        dateRetired: null,
        dateWarranty: null,
        location: { resourceType: "Member", id: holderId },
        holder: { id: holderId },
        ...overrides,
    };
}

const members = [
    { id: 1, name: "Aroha", email: "aroha@example.com" },
    { id: 2, name: "Ben", email: null },
];

function snapshot(items: KitCheckIssuedItem[]) {
    const comparison = compareBundle({
        lines: [harnessLine, glovesLine],
        members,
        items,
        fittingTemplateIds: [T.harness, T.gloves],
    });
    return buildKitCheckSnapshot({
        columns: comparison.columns,
        rows: comparison.rows,
        variants,
        fittingVariantIds,
    });
}

describe("buildKitCheckSnapshot", () => {
    it("offers a template's fitting variants with D4H records, and a free size without any", () => {
        const { templates } = snapshot([]);

        expect(templates).toEqual([
            {
                id: T.harness,
                category: "Rope",
                name: "Harness",
                variants: [
                    { id: "avao", label: "Petzl Avao" },
                    { id: "falcon", label: "Petzl Falcon" },
                ],
                requireSN: true,
                sized: false,
                sizeOptional: true,
                sizeOptions: [],
            },
            {
                id: T.gloves,
                category: "PPE",
                name: "Gloves",
                variants: [],
                requireSN: false,
                sized: true,
                sizeOptional: true,
                sizeOptions: [],
            },
        ]);
        expect(templates[0]).not.toHaveProperty("allowOwn");
        expect(templates[0]).not.toHaveProperty("optional");
    });

    it("lists each counted item, matching a variant on brand and model, with its serial", () => {
        const { members: result } = snapshot([
            item(10, 1, HARNESS_KIND, {
                serial: "H-1",
                brand: { resourceType: "EquipmentBrand", id: 1, title: "Petzl" },
                model: { resourceType: "EquipmentModel", id: 12, title: "Falcon" },
            }),
            item(11, 1, GLOVES_KIND),
            // LOST: doesn't count.
            item(12, 1, GLOVES_KIND, { status: "LOST" }),
        ]);

        const aroha = result.find((entry) => entry.member.id === 1)!;
        expect(aroha.heldCount).toBe(2);
        expect(aroha.heldItems).toEqual([
            {
                id: "10",
                templateId: T.harness,
                description: "Petzl Falcon",
                serial: "H-1",
                variantId: "falcon",
                problems: [],
            },
            {
                id: "11",
                templateId: T.gloves,
                description: "000011",
                serial: null,
                variantId: null,
                problems: [],
            },
        ]);

        const ben = result.find((entry) => entry.member.id === 2)!;
        expect(ben).toMatchObject({ member: members[1], heldCount: 0, heldItems: [] });
    });

    it("flags a missing serial, a missing model and a brand/model that's no variant", () => {
        const { members: result } = snapshot([
            // No serial, no model.
            item(20, 1, HARNESS_KIND, {
                brand: { resourceType: "EquipmentBrand", id: 1, title: "Petzl" },
            }),
            // Has a serial, but a model that's not one of the variants.
            item(21, 2, HARNESS_KIND, {
                serial: "H-2",
                brand: { resourceType: "EquipmentBrand", id: 1, title: "Petzl" },
                model: { resourceType: "EquipmentModel", id: 99, title: "Old" },
            }),
        ]);

        const byId = new Map(
            result.flatMap((entry) => entry.heldItems).map((held) => [held.id, held]),
        );
        expect(byId.get("20")).toMatchObject({
            description: "Petzl",
            variantId: null,
            problems: ["serial", "variant"],
        });
        expect(byId.get("21")).toMatchObject({ variantId: null, problems: ["variant"] });
    });

    it("pre-fills every held item as held, and nothing else", () => {
        const { members: result } = snapshot([item(30, 1, GLOVES_KIND), item(31, 1, GLOVES_KIND)]);

        const { response } = result.find((entry) => entry.member.id === 1)!;
        expect(response).toEqual({
            held: {
                "30": { ...EMPTY_ANSWER, has: "yes" },
                "31": { ...EMPTY_ANSWER, has: "yes" },
            },
            missing: {},
            extras: [],
            comments: "",
        });
        expect(KitCheckResponseData.parse(response)).toEqual(response);
    });
});
