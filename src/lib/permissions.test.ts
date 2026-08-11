/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { Permissions, Roles, roles } from "./permissions";

function can(role: keyof typeof Roles, permissions: Permissions): boolean {
    return Roles[role].authorize(permissions).success;
}

describe("Roles", () => {
    // `organizationProcedure` forces `organization: ["view"]` into every requirement, and
    // the organization layout gates on it too. A role without it cannot reach anything —
    // which is exactly how `skill-package-author` ended up non-functional.
    it.each(roles)("%s can view the organization", (role) => {
        expect(can(role, { organization: ["view"] })).toBe(true);
    });

    describe("i3-editor", () => {
        // getLinkedPerson / listPersonLinks / getLinkedUser all require both halves.
        it("can read the user↔person link", () => {
            expect(can("i3-editor", { member: ["view"], person: ["view"] })).toBe(true);
        });

        it("can work items but not author templates", () => {
            expect(can("i3-editor", { i3Item: ["issue"] })).toBe(true);
            expect(can("i3-editor", { i3Template: ["view"] })).toBe(true);
            expect(can("i3-editor", { i3Template: ["create"] })).toBe(false);
        });
    });

    describe("skills-assessor", () => {
        it("can record and amend skill checks", () => {
            expect(can("skills-assessor", { skillCheck: ["create"] })).toBe(true);
            expect(can("skills-assessor", { skillCheck: ["update"] })).toBe(true);
            expect(can("skills-assessor", { skillCheck: ["delete"] })).toBe(true);
        });

        // approveSession requires both halves.
        it("can approve a session", () => {
            expect(
                can("skills-assessor", {
                    skillCheckSession: ["update"],
                    skillCheck: ["update"],
                }),
            ).toBe(true);
        });
    });

    describe("skill-package-author", () => {
        it("can author packages", () => {
            expect(can("skill-package-author", { skillPackageBuilder: ["publish"] })).toBe(true);
        });

        it("cannot administer the organization", () => {
            expect(can("skill-package-author", { organization: ["update"] })).toBe(false);
            expect(can("skill-package-author", { person: ["create"] })).toBe(false);
        });
    });

    describe("member", () => {
        // Deliberately read-only: the omissions below are intentional, not gaps.
        it("is read-only", () => {
            expect(can("member", { person: ["view"] })).toBe(true);
            expect(can("member", { team: ["view"] })).toBe(true);
            expect(can("member", { person: ["create"] })).toBe(false);
            expect(can("member", { team: ["update"] })).toBe(false);
            expect(can("member", { skillCheck: ["view"] })).toBe(false);
        });
    });

    describe("owner and admin", () => {
        it("hold every statement, except that only the owner may delete the org", () => {
            expect(can("owner", { organization: ["delete"] })).toBe(true);
            expect(can("admin", { organization: ["delete"] })).toBe(false);
            expect(can("admin", { organization: ["update"] })).toBe(true);

            for (const role of ["owner", "admin"] as const) {
                expect(can(role, { person: ["create", "delete"] })).toBe(true);
                expect(can(role, { skillPackageBuilder: ["publish"] })).toBe(true);
                expect(can(role, { i3Template: ["create"] })).toBe(true);
            }
        });
    });
});
