/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import {
    catalogueRecordFitsTeam,
    isOrganisationOwned,
    isOwnedByOrganisation,
    templateFitsTeam,
    usesOtherRecords,
    variantFitsTeam,
    variantUsesOtherRecords,
    type CatalogueRecord,
    type FitTeam,
    type TeamCatalogue,
} from "./i3-template-fit";

const ORG_ID = 900;
const OTHER_ORG_ID = 901;
const TEAM_T = 10;
const TEAM_OTHER = 11; // reachable, but not T
const TEAM_UNREACHABLE = 99;

const team: FitTeam = { id: TEAM_T, owner: { id: ORG_ID } };

function teamOwned(id: number, teamId: number): CatalogueRecord {
    return { id, owner: { resourceType: "Team", id: teamId } };
}

function orgOwned(id: number, orgId: number): CatalogueRecord {
    return { id, owner: { resourceType: "Organisation", id: orgId } };
}

describe("isOrganisationOwned", () => {
    it("is true for an Organisation owner and false for a Team owner", () => {
        expect(isOrganisationOwned({ resourceType: "Organisation", id: ORG_ID })).toBe(true);
        expect(isOrganisationOwned({ resourceType: "Team", id: TEAM_T })).toBe(false);
    });
});

describe("isOwnedByOrganisation", () => {
    it("is true only for an Organisation owner with that id", () => {
        expect(isOwnedByOrganisation({ resourceType: "Organisation", id: ORG_ID }, ORG_ID)).toBe(
            true,
        );
        expect(
            isOwnedByOrganisation({ resourceType: "Organisation", id: OTHER_ORG_ID }, ORG_ID),
        ).toBe(false);
        expect(isOwnedByOrganisation({ resourceType: "Team", id: ORG_ID }, ORG_ID)).toBe(false);
    });
});

describe("catalogueRecordFitsTeam", () => {
    it("fits a record owned by the team itself", () => {
        expect(catalogueRecordFitsTeam(teamOwned(1, TEAM_T), team)).toBe(true);
    });

    it("doesn't fit a record owned by another reachable team", () => {
        expect(catalogueRecordFitsTeam(teamOwned(1, TEAM_OTHER), team)).toBe(false);
    });

    it("doesn't fit a record owned by an unreachable team, even though the team lists it", () => {
        expect(catalogueRecordFitsTeam(teamOwned(1, TEAM_UNREACHABLE), team)).toBe(false);
    });

    it("fits a record owned by the team's organisation", () => {
        expect(catalogueRecordFitsTeam(orgOwned(1, ORG_ID), team)).toBe(true);
    });

    it("doesn't fit a record owned by another organisation", () => {
        expect(catalogueRecordFitsTeam(orgOwned(1, OTHER_ORG_ID), team)).toBe(false);
    });

    it("doesn't fit an organisation-owned record for a team with no organisation", () => {
        expect(catalogueRecordFitsTeam(orgOwned(1, ORG_ID), { id: TEAM_T, owner: null })).toBe(
            false,
        );
        expect(catalogueRecordFitsTeam(orgOwned(1, ORG_ID), { id: TEAM_T })).toBe(false);
    });

    it("doesn't fit a record missing from the team's listing", () => {
        expect(catalogueRecordFitsTeam(undefined, team)).toBe(false);
    });
});

describe("templateFitsTeam and variantFitsTeam", () => {
    const catalogue: TeamCatalogue = {
        categories: [orgOwned(1, ORG_ID), teamOwned(2, TEAM_OTHER)],
        kinds: [teamOwned(3, TEAM_T), teamOwned(4, TEAM_UNREACHABLE)],
        brands: [orgOwned(5, ORG_ID), orgOwned(6, OTHER_ORG_ID)],
        models: [teamOwned(7, TEAM_T)],
    };

    const fittingTemplate = { categoryId: 1, kindId: 3 };
    const fittingVariant = { brandId: 5, modelId: 7 };

    it("fits a template whose category and kind both fit", () => {
        expect(templateFitsTeam(fittingTemplate, catalogue, team)).toBe(true);
    });

    it("doesn't fit a template with a category owned by another team", () => {
        expect(templateFitsTeam({ categoryId: 2, kindId: 3 }, catalogue, team)).toBe(false);
    });

    it("doesn't fit a template with a kind owned by an unreachable team", () => {
        expect(templateFitsTeam({ categoryId: 1, kindId: 4 }, catalogue, team)).toBe(false);
    });

    it("doesn't fit a template whose kind is missing from the team's listing", () => {
        expect(templateFitsTeam({ categoryId: 1, kindId: 404 }, catalogue, team)).toBe(false);
    });

    it("doesn't fit a template with no D4H configuration", () => {
        expect(templateFitsTeam(null, catalogue, team)).toBe(false);
    });

    it("fits a variant whose brand, model and template all fit", () => {
        expect(variantFitsTeam(fittingVariant, fittingTemplate, catalogue, team)).toBe(true);
    });

    it("doesn't fit a variant with a brand owned by another organisation", () => {
        expect(variantFitsTeam({ brandId: 6, modelId: 7 }, fittingTemplate, catalogue, team)).toBe(
            false,
        );
    });

    it("doesn't fit a variant whose model is missing from the team's listing", () => {
        expect(
            variantFitsTeam({ brandId: 5, modelId: 404 }, fittingTemplate, catalogue, team),
        ).toBe(false);
    });

    it("doesn't fit a variant with no D4H configuration", () => {
        expect(variantFitsTeam(null, fittingTemplate, catalogue, team)).toBe(false);
    });

    it("doesn't fit a fitting variant whose template doesn't fit", () => {
        expect(variantFitsTeam(fittingVariant, { categoryId: 2, kindId: 3 }, catalogue, team)).toBe(
            false,
        );
        expect(variantFitsTeam(fittingVariant, null, catalogue, team)).toBe(false);
    });
});

describe("usesOtherRecords and variantUsesOtherRecords", () => {
    const catalogue: TeamCatalogue = {
        categories: [orgOwned(1, ORG_ID), teamOwned(2, TEAM_T)],
        kinds: [orgOwned(3, ORG_ID), orgOwned(4, OTHER_ORG_ID)],
        brands: [orgOwned(5, ORG_ID), teamOwned(6, TEAM_T)],
        models: [orgOwned(7, ORG_ID), orgOwned(8, OTHER_ORG_ID)],
    };

    it("doesn't flag a template using only the linked organisation's records", () => {
        expect(usesOtherRecords({ categoryId: 1, kindId: 3 }, catalogue, ORG_ID)).toBe(false);
    });

    it("flags a template with a team-owned record", () => {
        expect(usesOtherRecords({ categoryId: 2, kindId: 3 }, catalogue, ORG_ID)).toBe(true);
    });

    it("flags a template with a record owned by another organisation", () => {
        expect(usesOtherRecords({ categoryId: 1, kindId: 4 }, catalogue, ORG_ID)).toBe(true);
    });

    it("doesn't flag a template whose records aren't found, or with no D4H configuration", () => {
        expect(usesOtherRecords({ categoryId: 404, kindId: 405 }, catalogue, ORG_ID)).toBe(false);
        expect(usesOtherRecords(null, catalogue, ORG_ID)).toBe(false);
    });

    it("doesn't flag a variant using only the linked organisation's records", () => {
        expect(variantUsesOtherRecords({ brandId: 5, modelId: 7 }, catalogue, ORG_ID)).toBe(false);
    });

    it("flags a variant with a team-owned record", () => {
        expect(variantUsesOtherRecords({ brandId: 6, modelId: 7 }, catalogue, ORG_ID)).toBe(true);
    });

    it("flags a variant with a record owned by another organisation", () => {
        expect(variantUsesOtherRecords({ brandId: 5, modelId: 8 }, catalogue, ORG_ID)).toBe(true);
    });

    it("doesn't flag a variant whose records aren't found, or with no D4H configuration", () => {
        expect(variantUsesOtherRecords({ brandId: 404, modelId: 405 }, catalogue, ORG_ID)).toBe(
            false,
        );
        expect(variantUsesOtherRecords(null, catalogue, ORG_ID)).toBe(false);
    });
});
