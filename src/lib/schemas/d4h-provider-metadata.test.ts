/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { D4HAccessTokenMetadata, D4HProviderMetadata } from "./d4h-provider-metadata";

describe("D4H metadata schemas", () => {
    // Production hit this (#171): a failed whoami check once wrote metadata with the field
    // omitted (via a since-fixed misspelling), and reading that row back crashed the whole
    // query with a ZodError instead of just showing no known organisations.
    it("defaults d4HOrganisations to [] when a stored record is missing it", () => {
        expect(D4HAccessTokenMetadata.schema.parse({ d4HTeams: [] })).toEqual({
            d4HTeams: [],
            d4HOrganisations: [],
        });
    });

    it("reads a stored ProviderCredential row that has only the misspelled key", () => {
        const parsed = D4HProviderMetadata.schema.parse({
            provider: "D4H",
            serverCode: "us",
            d4HTeams: [],
            d4HOrganizations: [],
        });
        expect(parsed.d4HOrganisations).toEqual([]);
    });
});
