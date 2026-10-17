/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import {
    OrganizationGroupData,
    OrganizationGroupId,
    OrganizationGroupMembershipId,
    OrganizationGroupRef,
} from "./organization-group";

describe("OrganizationGroupId / OrganizationGroupMembershipId", () => {
    it("create() produces an id that parses", () => {
        expect(OrganizationGroupId.schema.safeParse(OrganizationGroupId.create()).success).toBe(
            true,
        );
        expect(
            OrganizationGroupMembershipId.schema.safeParse(OrganizationGroupMembershipId.create())
                .success,
        ).toBe(true);
    });

    it("rejects a malformed id", () => {
        expect(OrganizationGroupId.schema.safeParse("not-an-id").success).toBe(false);
    });
});

describe("OrganizationGroupData.createSchema", () => {
    const valid = (slug: string) =>
        OrganizationGroupData.createSchema.safeParse({ name: "Region", slug }).success;

    it("accepts lowercase letters, digits and hyphens", () => {
        expect(valid("north-region-2")).toBe(true);
    });

    it("rejects uppercase, underscores and spaces", () => {
        expect(valid("North")).toBe(false);
        expect(valid("north_region")).toBe(false);
        expect(valid("north region")).toBe(false);
    });

    it("enforces the 2–50 character length", () => {
        expect(valid("a")).toBe(false);
        expect(valid("ab")).toBe(true);
        expect(valid("a".repeat(50))).toBe(true);
        expect(valid("a".repeat(51))).toBe(false);
    });
});

describe("OrganizationGroupRef", () => {
    it("accepts a 2-character group name", () => {
        expect(
            OrganizationGroupRef.schema.safeParse({ id: OrganizationGroupId.create(), name: "NZ" })
                .success,
        ).toBe(true);
    });

    it("rejects a 1-character group name", () => {
        expect(
            OrganizationGroupRef.schema.safeParse({ id: OrganizationGroupId.create(), name: "N" })
                .success,
        ).toBe(false);
    });
});
