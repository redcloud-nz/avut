/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { deriveStatus, tallyStatuses } from "./competency-status";

describe("deriveStatus", () => {
    it("reads a missing check as not-assessed", () => {
        expect(deriveStatus(undefined)).toBe("not-assessed");
    });

    it("reads a non-competent result as not-competent regardless of currency", () => {
        expect(deriveStatus({ result: "Fail", isCurrent: true })).toBe("not-competent");
        expect(deriveStatus({ result: "NotTaught", isCurrent: true })).toBe("not-competent");
    });

    it("distinguishes current from expired for a competent result", () => {
        expect(deriveStatus({ result: "Pass", isCurrent: true })).toBe("current");
        expect(deriveStatus({ result: "Pass", isCurrent: false })).toBe("expired");
    });
});

describe("tallyStatuses", () => {
    it("counts each bucket and zero-fills the rest", () => {
        expect(tallyStatuses(["current", "current", "expired", "not-assessed"])).toEqual({
            current: 2,
            expired: 1,
            "not-competent": 0,
            "not-assessed": 1,
        });
    });

    it("returns an all-zero tally for an empty input", () => {
        expect(tallyStatuses([])).toEqual({
            current: 0,
            expired: 0,
            "not-competent": 0,
            "not-assessed": 0,
        });
    });
});
