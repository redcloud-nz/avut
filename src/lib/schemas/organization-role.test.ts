/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { OrganizationRole } from "./organization-role";

describe("OrganizationRole.parseStored", () => {
    it("reads a comma-joined role set in stored order", () => {
        expect(OrganizationRole.parseStored("admin,i3-editor")).toEqual(["admin", "i3-editor"]);
    });

    it("drops unrecognised entries instead of throwing", () => {
        expect(OrganizationRole.parseStored("member,retired-role,, i3-editor ")).toEqual([
            "member",
            "i3-editor",
        ]);
    });

    it("returns an empty list for an empty stored value", () => {
        expect(OrganizationRole.parseStored("")).toEqual([]);
    });
});

describe("OrganizationRole.formatList", () => {
    it("formats a stored value with display names", () => {
        expect(OrganizationRole.formatList("admin,i3-editor")).toBe(
            `${OrganizationRole.displayNames.admin}, ${OrganizationRole.displayNames["i3-editor"]}`,
        );
    });

    it("shows an unrecognised role as stored rather than 'undefined'", () => {
        expect(OrganizationRole.formatList("member,retired-role")).toBe(
            `${OrganizationRole.displayNames.member}, retired-role`,
        );
    });
});
