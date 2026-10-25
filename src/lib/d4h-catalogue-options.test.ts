/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import {
    groupCatalogueOptions,
    type CatalogueOptionGroup,
    type CatalogueOptionOwner,
    type CatalogueOptionRecord,
} from "./d4h-catalogue-options";

const ORG: CatalogueOptionOwner = { resourceType: "Organisation", id: 900, title: "Zeta Org" };
const OTHER_ORG: CatalogueOptionOwner = {
    resourceType: "Organisation",
    id: 901,
    title: "Alpha Org",
};
const TEAM_A: CatalogueOptionOwner = { resourceType: "Team", id: 10, title: "Avalanche Team" };
const TEAM_B: CatalogueOptionOwner = { resourceType: "Team", id: 11, title: "Bush Team" };

function record(id: number, title: string, owner: CatalogueOptionOwner): CatalogueOptionRecord {
    return { id, title, owner };
}

/** Each group as `owner title: record titles`, with a `*` after marked records. */
function summarise(groups: CatalogueOptionGroup<CatalogueOptionRecord>[]): string[] {
    return groups.map(
        (group) =>
            `${group.owner.title}: ${group.options
                .map((option) => option.record.title + (option.otherOwnerMarker ? "*" : ""))
                .join(", ")}`,
    );
}

describe("groupCatalogueOptions", () => {
    const records = [
        record(1, "Rope", TEAM_B),
        record(2, "Helmet", TEAM_A),
        record(3, "Radio", ORG),
        record(4, "Harness", TEAM_B),
        record(5, "Beacon", ORG),
        record(6, "Torch", OTHER_ORG),
    ];

    it("puts organisation groups first, then teams, each A–Z, with records A–Z", () => {
        const groups = groupCatalogueOptions(records, {
            organisationOnlyId: null,
            selectedId: null,
        });

        expect(summarise(groups)).toEqual([
            "Alpha Org: Torch",
            "Zeta Org: Beacon, Radio",
            "Avalanche Team: Helmet",
            "Bush Team: Harness, Rope",
        ]);
    });

    it("returns a single group when every record has the same owner", () => {
        const groups = groupCatalogueOptions([records[0], records[3]], {
            organisationOnlyId: null,
            selectedId: null,
        });

        expect(summarise(groups)).toEqual(["Bush Team: Harness, Rope"]);
    });

    it("keeps only the given organisation's records, hiding teams and other organisations", () => {
        const groups = groupCatalogueOptions(records, {
            organisationOnlyId: ORG.id,
            selectedId: null,
        });

        expect(summarise(groups)).toEqual(["Zeta Org: Beacon, Radio"]);
    });

    it("keeps a selected record that the organisation-only filter would drop, marked", () => {
        const groups = groupCatalogueOptions(records, {
            organisationOnlyId: ORG.id,
            selectedId: 4,
        });

        expect(summarise(groups)).toEqual(["Zeta Org: Beacon, Radio", "Bush Team: Harness*"]);
    });

    it("doesn't mark a selected record the filter keeps", () => {
        const groups = groupCatalogueOptions(records, {
            organisationOnlyId: ORG.id,
            selectedId: 3,
        });

        expect(summarise(groups)).toEqual(["Zeta Org: Beacon, Radio"]);
    });

    it("marks nothing when there's no organisation filter", () => {
        const groups = groupCatalogueOptions(records, {
            organisationOnlyId: null,
            selectedId: 4,
        });

        expect(groups.flatMap((group) => group.options).some((o) => o.otherOwnerMarker)).toBe(
            false,
        );
    });
});
