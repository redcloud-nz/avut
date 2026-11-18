/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import {
    compareBundle,
    groupColumnsByCategory,
    type BundleCompareItem,
    type BundleCompareLine,
} from "./i3-bundle-compare";

const KIND_HELMET = 100;
const KIND_JACKET = 200;
const KIND_BOOTS = 300;

const ALICE = { id: 1, name: "Alice" };
const BOB = { id: 2, name: "Bob" };
const CAROL = { id: 3, name: "Carol" };

function line(
    id: string,
    kindId: number | null,
    status: "Active" | "Deleted" = "Active",
): BundleCompareLine {
    return { template: { id, status, d4h: kindId === null ? null : { kindId } } };
}

let nextItemId = 1;
function item(
    holderId: number,
    kindId: number,
    status = "OPERATIONAL",
): BundleCompareItem & { id: number } {
    return { id: nextItemId++, status, kind: { id: kindId }, holder: { id: holderId } };
}

const helmet = line("helmet", KIND_HELMET);
const jacket = line("jacket", KIND_JACKET);

describe("compareBundle", () => {
    it("marks a member held when they hold an item of the line's kind, missing otherwise", () => {
        const aliceHelmet = item(ALICE.id, KIND_HELMET);
        const result = compareBundle({
            lines: [helmet, jacket],
            members: [ALICE],
            items: [aliceHelmet],
            fittingTemplateIds: ["helmet", "jacket"],
        });

        expect(result.columns).toEqual([helmet, jacket]);
        expect(result.excluded).toEqual([]);
        expect(result.rows).toEqual([
            {
                member: ALICE,
                cells: [
                    { state: "held", items: [aliceHelmet], lost: [] },
                    { state: "missing", items: [], lost: [] },
                ],
                heldCount: 1,
            },
        ]);
        expect(result.columnTotals).toEqual([1, 0]);
    });

    it("doesn't count a LOST item but keeps it on the cell's lost list", () => {
        const lostHelmet = item(ALICE.id, KIND_HELMET, "LOST");
        const result = compareBundle({
            lines: [helmet],
            members: [ALICE],
            items: [lostHelmet],
            fittingTemplateIds: ["helmet"],
        });

        expect(result.rows[0].cells[0]).toEqual({
            state: "missing",
            items: [],
            lost: [lostHelmet],
        });
        expect(result.rows[0].heldCount).toBe(0);
        expect(result.columnTotals).toEqual([0]);
    });

    it("counts a held item alongside a lost one of the same kind", () => {
        const lostHelmet = item(ALICE.id, KIND_HELMET, "LOST");
        const spareHelmet = item(ALICE.id, KIND_HELMET, "UNSERVICEABLE");
        const result = compareBundle({
            lines: [helmet],
            members: [ALICE],
            items: [lostHelmet, spareHelmet],
            fittingTemplateIds: ["helmet"],
        });

        expect(result.rows[0].cells[0]).toEqual({
            state: "held",
            items: [spareHelmet],
            lost: [lostHelmet],
        });
    });

    it("ignores a RETIRED item entirely", () => {
        const result = compareBundle({
            lines: [helmet],
            members: [ALICE],
            items: [item(ALICE.id, KIND_HELMET, "RETIRED")],
            fittingTemplateIds: ["helmet"],
        });

        expect(result.rows[0].cells[0]).toEqual({ state: "missing", items: [], lost: [] });
    });

    it("excludes deleted, no-D4H-type and not-in-team lines, keeping line order", () => {
        const deleted = line("deleted", KIND_BOOTS, "Deleted");
        const noType = line("no-type", null);
        const otherTeam = line("other-team", KIND_BOOTS);
        const result = compareBundle({
            lines: [deleted, helmet, noType, otherTeam, jacket],
            members: [ALICE],
            items: [item(ALICE.id, KIND_BOOTS)],
            fittingTemplateIds: ["helmet", "jacket", "deleted", "no-type"],
        });

        expect(result.columns).toEqual([helmet, jacket]);
        expect(result.excluded).toEqual([
            { line: deleted, reason: "deleted" },
            { line: noType, reason: "no-d4h-type" },
            { line: otherTeam, reason: "not-in-team" },
        ]);
        expect(result.rows[0].cells).toHaveLength(2);
    });

    it("matches one item against two lines on the same kind", () => {
        const helmetToo = line("helmet-too", KIND_HELMET);
        const aliceHelmet = item(ALICE.id, KIND_HELMET);
        const result = compareBundle({
            lines: [helmet, helmetToo],
            members: [ALICE],
            items: [aliceHelmet],
            fittingTemplateIds: ["helmet", "helmet-too"],
        });

        expect(result.rows[0].cells.map((cell) => cell.state)).toEqual(["held", "held"]);
        expect(result.rows[0].heldCount).toBe(2);
        expect(result.columnTotals).toEqual([1, 1]);
    });

    it("leaves out items whose holder isn't a member, and sorts members by name", () => {
        const result = compareBundle({
            lines: [helmet],
            members: [CAROL, ALICE, BOB],
            items: [item(99, KIND_HELMET), item(BOB.id, KIND_HELMET)],
            fittingTemplateIds: ["helmet"],
        });

        expect(result.rows.map((row) => row.member)).toEqual([ALICE, BOB, CAROL]);
        expect(result.rows.map((row) => row.cells[0].state)).toEqual([
            "missing",
            "held",
            "missing",
        ]);
        expect(result.columnTotals).toEqual([1]);
    });

    it("handles an empty bundle", () => {
        const result = compareBundle({
            lines: [],
            members: [ALICE],
            items: [item(ALICE.id, KIND_HELMET)],
            fittingTemplateIds: [],
        });

        expect(result).toEqual({
            columns: [],
            excluded: [],
            rows: [{ member: ALICE, cells: [], heldCount: 0 }],
            columnTotals: [],
        });
    });

    it("handles an empty team", () => {
        const result = compareBundle({
            lines: [helmet],
            members: [],
            items: [],
            fittingTemplateIds: ["helmet"],
        });

        expect(result).toEqual({ columns: [helmet], excluded: [], rows: [], columnTotals: [0] });
    });
});

describe("groupColumnsByCategory", () => {
    function column(categoryId: number, categoryTitle: string) {
        return { template: { d4h: { categoryId, categoryTitle } } };
    }

    it("groups adjacent columns of one category into a run", () => {
        expect(
            groupColumnsByCategory([
                column(1, "Clothing"),
                column(1, "Clothing"),
                column(2, "PPE"),
            ]),
        ).toEqual([
            { key: "1-0", categoryId: 1, title: "Clothing", start: 0, span: 2 },
            { key: "2-2", categoryId: 2, title: "PPE", start: 2, span: 1 },
        ]);
    });

    it("keeps two categories that share a title apart", () => {
        expect(
            groupColumnsByCategory([column(1, "Gear"), column(2, "Gear"), column(2, "Gear")]),
        ).toEqual([
            { key: "1-0", categoryId: 1, title: "Gear", start: 0, span: 1 },
            { key: "2-1", categoryId: 2, title: "Gear", start: 1, span: 2 },
        ]);
    });

    it("gives each run of a split category its own key", () => {
        const groups = groupColumnsByCategory([
            column(1, "Clothing"),
            column(2, "Gear"),
            column(1, "Clothing (old)"),
        ]);

        expect(groups.map((group) => group.key)).toEqual(["1-0", "2-1", "1-2"]);
    });

    it("returns no groups for no columns", () => {
        expect(groupColumnsByCategory([])).toEqual([]);
    });
});
