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

    it("shows owner by its display name, though no picker offers it", () => {
        expect(OrganizationRole.formatList("owner,member")).toBe("Owner, Member");
    });

    it("shows an unrecognised role as stored rather than 'undefined'", () => {
        expect(OrganizationRole.formatList("member,retired-role")).toBe(
            `${OrganizationRole.displayNames.member}, retired-role`,
        );
    });
});

describe("OrganizationRole.groups", () => {
    it("groups roles by module, each module's admin role first", () => {
        expect(OrganizationRole.groups.map((g) => [g.title, g.roles])).toEqual([
            ["Organisation", ["admin", "member"]],
            ["I3", ["i3-admin", "i3-editor"]],
            ["Skill Track", ["skills-admin", "skills-assessor", "skills-reporter"]],
            ["Skill Package Builder", ["skills-author"]],
        ]);
    });
});

describe("OrganizationRole.formDefaults", () => {
    it("drops roles another stored non-owner role covers", () => {
        expect(OrganizationRole.formDefaults("skills-admin,skills-assessor,i3-editor")).toEqual([
            "skills-admin",
            "i3-editor",
        ]);
    });

    it("keeps a role only owner covers — the member keeps it if ownership is removed", () => {
        expect(OrganizationRole.formDefaults("owner,admin")).toEqual(["admin"]);
    });

    it("keeps roles nothing else covers", () => {
        expect(OrganizationRole.formDefaults("member,skills-assessor")).toEqual([
            "member",
            "skills-assessor",
        ]);
    });
});
