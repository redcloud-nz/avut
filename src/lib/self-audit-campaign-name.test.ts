/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { defaultCampaignName } from "./self-audit-campaign-name";

describe("defaultCampaignName", () => {
    it("names the month in the given time zone", () => {
        // Still November in UTC, already December in New Zealand.
        const instant = new Date("2026-11-30T12:00:00Z");
        expect(defaultCampaignName("Responder", "Pacific/Auckland", instant)).toBe(
            "Responder Dec 2026",
        );
        expect(defaultCampaignName("Responder", "UTC", instant)).toBe("Responder Nov 2026");
    });
});
