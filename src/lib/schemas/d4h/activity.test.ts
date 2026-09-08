/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { formatD4HActivityLocation } from "./activity";

describe("formatD4HActivityLocation", () => {
    it("returns null when there is no address", () => {
        expect(formatD4HActivityLocation(null)).toBeNull();
        expect(formatD4HActivityLocation(undefined)).toBeNull();
    });

    it("joins street, town and region, skipping blanks", () => {
        expect(
            formatD4HActivityLocation({ street: "Bag End", town: "Hobbiton", region: "  " }),
        ).toBe("Bag End, Hobbiton");
    });

    it("returns null when every part is empty", () => {
        expect(formatD4HActivityLocation({ street: "", town: null, region: undefined })).toBeNull();
    });
});
