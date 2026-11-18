/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { TEAM_SLUG_RESERVED, TeamData, TeamSlug } from "./team";

describe("TeamSlug.schema", () => {
    const valid = (slug: string) => TeamSlug.schema.safeParse(slug).success;

    it("accepts lowercase letters, digits and hyphens", () => {
        expect(valid("north-shore-2")).toBe(true);
        expect(valid("ab")).toBe(true);
        expect(valid("a".repeat(50))).toBe(true);
    });

    it("rejects uppercase, underscores, spaces and other characters", () => {
        expect(valid("North")).toBe(false);
        expect(valid("north_shore")).toBe(false);
        expect(valid("north shore")).toBe(false);
        expect(valid("north.shore")).toBe(false);
    });

    it("rejects a slug that is too short", () => {
        expect(valid("a")).toBe(false);
        expect(valid("")).toBe(false);
    });

    it("rejects a slug that is too long", () => {
        expect(valid("a".repeat(51))).toBe(false);
    });

    it.each(TEAM_SLUG_RESERVED)("rejects the reserved word %s", (word) => {
        const result = TeamSlug.schema.safeParse(word);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("That slug is reserved.");
    });
});

describe("TeamData.modifiableSchema slug", () => {
    const base = { name: "Team One", description: "", tags: [], properties: {} };
    const parseSlug = (slug: unknown) => TeamData.modifiableSchema.safeParse({ ...base, slug });

    it("turns an empty string into null", () => {
        const result = parseSlug("");
        expect(result.success).toBe(true);
        expect(result.data?.slug).toBeNull();
    });

    it("accepts null", () => {
        expect(parseSlug(null).data?.slug).toBeNull();
    });

    it("keeps a valid slug", () => {
        expect(parseSlug("north-shore").data?.slug).toBe("north-shore");
    });

    it("rejects an invalid or reserved slug", () => {
        expect(parseSlug("North").success).toBe(false);
        expect(parseSlug("admin").success).toBe(false);
    });
});

describe("TeamData.schema slug", () => {
    it("reads any stored slug, including one reserved later", () => {
        const shape = TeamData.schema.shape.slug;
        expect(shape.safeParse("admin").success).toBe(true);
        expect(shape.safeParse(null).success).toBe(true);
    });
});
