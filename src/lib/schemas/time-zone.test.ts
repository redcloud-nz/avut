/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { isValidTimeZone, TimeZone } from "./time-zone";

describe("isValidTimeZone", () => {
    it("accepts IANA zones", () => {
        expect(isValidTimeZone("Pacific/Auckland")).toBe(true);
        expect(isValidTimeZone("America/New_York")).toBe(true);
        expect(isValidTimeZone("UTC")).toBe(true);
    });

    it("rejects names the runtime doesn't know", () => {
        expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
        expect(isValidTimeZone("")).toBe(false);
    });
});

describe("TimeZone.schema", () => {
    it("parses a known zone", () => {
        expect(TimeZone.schema.parse("Pacific/Auckland")).toBe("Pacific/Auckland");
    });

    it("rejects an unknown zone with a readable message", () => {
        const result = TimeZone.schema.safeParse("Mars/Olympus_Mons");
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Unknown IANA time zone");
    });
});
