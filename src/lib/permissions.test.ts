/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import {
    hasAnyRoleWithPermissions,
    hasOwnerRole,
    Permissions,
    roleCovers,
    Roles,
    roles,
} from "./permissions";

function can(role: keyof typeof Roles, permissions: Permissions): boolean {
    return Roles[role].authorize(permissions).success;
}

describe("Roles", () => {
    // `organizationProcedure` forces `organization: ["view"]` into every requirement, and
    // the organization layout gates on it too. A role without it cannot reach anything —
    // which is exactly how `skill-package-author` (now `skills-author`) once ended up
    // non-functional.
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

    describe("i3-admin", () => {
        it("can author and delete templates, including through trash", () => {
            expect(can("i3-admin", { i3Template: ["view", "create", "update", "delete"] })).toBe(
                true,
            );
        });

        it("covers i3-editor", () => {
            expect(roleCovers("i3-admin", "i3-editor")).toBe(true);
        });
    });

    describe("skills-assessor", () => {
        it("can record skill checks, but never update or delete one through the permission system", () => {
            expect(can("skills-assessor", { skillCheck: ["create"] })).toBe(true);
            // `skillCheck` has no `"update"` action at all any more — editing an existing check
            // is a row-ownership check in the router (`assessorId === current user`), not a
            // permission gate.
            expect(can("skills-assessor", { skillCheck: ["delete"] })).toBe(false);
        });

        it("can read personnel and teams to pick assessee and assessor", () => {
            expect(can("skills-assessor", { person: ["view"] })).toBe(true);
            expect(can("skills-assessor", { team: ["view"] })).toBe(true);
        });

        it("can create and update sessions, but not delete or approve them", () => {
            expect(can("skills-assessor", { skillCheckSession: ["create"] })).toBe(true);
            expect(can("skills-assessor", { skillCheckSession: ["update"] })).toBe(true);
            expect(can("skills-assessor", { skillCheckSession: ["delete"] })).toBe(false);
            expect(can("skills-assessor", { skillCheckSession: ["approve"] })).toBe(false);
        });

        it("cannot subscribe to skill packages", () => {
            expect(can("skills-assessor", { skillPackageSubscription: ["view"] })).toBe(true);
            expect(can("skills-assessor", { skillPackageSubscription: ["subscribe"] })).toBe(false);
        });
    });

    describe("skills-admin", () => {
        it("approves and cleans up sessions and deletes erroneous checks", () => {
            expect(can("skills-admin", { skillCheckSession: ["approve"] })).toBe(true);
            expect(can("skills-admin", { skillCheckSession: ["delete"] })).toBe(true);
            expect(can("skills-admin", { skillCheck: ["delete"] })).toBe(true);
        });

        // The session pages list personnel and teams (`listPersonnel`, `teams.listTeams`) to
        // pick assessors and assessees — without these the role can't open them.
        it("can read personnel and teams to manage session personnel", () => {
            expect(can("skills-admin", { person: ["view"] })).toBe(true);
            expect(can("skills-admin", { team: ["view"] })).toBe(true);
        });

        it("is the only role that can subscribe to skill packages", () => {
            expect(can("skills-admin", { skillPackageSubscription: ["subscribe"] })).toBe(true);
            for (const role of roles.filter((r) => r !== "skills-admin")) {
                expect(can(role, { skillPackageSubscription: ["subscribe"] })).toBe(false);
            }
        });

        it("covers skills-assessor and skills-reporter", () => {
            expect(roleCovers("skills-admin", "skills-assessor")).toBe(true);
            expect(roleCovers("skills-admin", "skills-reporter")).toBe(true);
        });
    });

    describe("skills-author", () => {
        it("can author packages", () => {
            expect(can("skills-author", { skillPackage: ["publish"] })).toBe(true);
        });

        it("cannot administer the organization", () => {
            expect(can("skills-author", { organization: ["update"] })).toBe(false);
            expect(can("skills-author", { person: ["create"] })).toBe(false);
        });
    });

    describe("skills-reporter", () => {
        it("is read-only across the skills surface", () => {
            expect(can("skills-reporter", { skillCheck: ["view"] })).toBe(true);
            expect(can("skills-reporter", { skillCheckSession: ["view"] })).toBe(true);
            expect(can("skills-reporter", { skillPackageSubscription: ["view"] })).toBe(true);
            expect(can("skills-reporter", { person: ["view"] })).toBe(true);
            expect(can("skills-reporter", { team: ["view"] })).toBe(true);
        });

        it("cannot create, update, delete, or approve anything", () => {
            expect(can("skills-reporter", { skillCheck: ["create"] })).toBe(false);
            expect(can("skills-reporter", { skillCheckSession: ["create"] })).toBe(false);
            expect(can("skills-reporter", { skillCheckSession: ["approve"] })).toBe(false);
            expect(can("skills-reporter", { skillPackageSubscription: ["subscribe"] })).toBe(false);
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

        it("no longer holds member:view", () => {
            expect(can("member", { member: ["view"] })).toBe(false);
        });

        it("keeps the baseline skillPackageSubscription:view", () => {
            expect(can("member", { skillPackageSubscription: ["view"] })).toBe(true);
            expect(can("member", { skillPackageSubscription: ["subscribe"] })).toBe(false);
        });
    });

    describe("owner and admin", () => {
        it("hold admin CRUD, except that only the owner may delete the org or grant ownership", () => {
            expect(can("owner", { organization: ["delete"] })).toBe(true);
            expect(can("admin", { organization: ["delete"] })).toBe(false);
            expect(can("admin", { organization: ["update"] })).toBe(true);

            expect(can("owner", { member: ["owner"] })).toBe(true);
            expect(can("admin", { member: ["owner"] })).toBe(false);

            for (const role of ["owner", "admin"] as const) {
                expect(can(role, { member: ["create", "update", "delete"] })).toBe(true);
                expect(can(role, { invitation: ["create", "update", "cancel"] })).toBe(true);
                expect(can(role, { person: ["create", "delete"] })).toBe(true);
                expect(can(role, { team: ["create", "delete"] })).toBe(true);
                expect(can(role, { skillPackageSubscription: ["view"] })).toBe(true);
            }
        });

        it("get no module-specific access beyond what member already has", () => {
            for (const role of ["owner", "admin"] as const) {
                expect(can(role, { i3Item: ["view"] })).toBe(false);
                expect(can(role, { i3Template: ["view"] })).toBe(false);
                expect(can(role, { skillCheck: ["view"] })).toBe(false);
                expect(can(role, { skillCheckSession: ["view"] })).toBe(false);
                expect(can(role, { skillPackage: ["view"] })).toBe(false);
                expect(can(role, { skillPackageSubscription: ["subscribe"] })).toBe(false);
            }
        });
    });
});

describe("hasAnyRoleWithPermissions", () => {
    // Pins equivalence with Better Auth's own `hasPermissionFn` (organization plugin): granted
    // if a single role in the list authorizes the full permission set. Only holds because AVUT's
    // org plugin config sets no `creatorRole`/`allowCreatorAllPermissions` override — if either
    // is ever configured, this equivalence (and the local-evaluation optimisation it justifies
    // in `createTrpcContext`) needs revisiting.
    it("grants when any single role authorizes every requested permission", () => {
        expect(hasAnyRoleWithPermissions(["member"], { person: ["view"] })).toBe(true);
        expect(hasAnyRoleWithPermissions(["member", "owner"], { organization: ["delete"] })).toBe(
            true,
        );
    });

    it("denies when no single role covers the full request", () => {
        expect(hasAnyRoleWithPermissions(["member"], { person: ["delete"] })).toBe(false);
        expect(hasAnyRoleWithPermissions([], { person: ["view"] })).toBe(false);
    });

    it("does not grant by summing partial permissions across roles", () => {
        // "i3-editor" has i3Item but not skillCheck, "skills-assessor" has skillCheck but not
        // i3Item — neither role alone satisfies a request for both.
        expect(
            hasAnyRoleWithPermissions(["i3-editor", "skills-assessor"], {
                i3Item: ["issue"],
                skillCheck: ["create"],
            }),
        ).toBe(false);
    });

    it("lets admin and member be held simultaneously — the primary/secondary split is gone", () => {
        expect(hasAnyRoleWithPermissions(["admin", "member"], { member: ["create"] })).toBe(true);
        expect(
            hasAnyRoleWithPermissions(["admin", "member"], { skillPackageSubscription: ["view"] }),
        ).toBe(true);
    });
});

describe("hasOwnerRole", () => {
    it("matches owner as a whole stored entry, alongside other roles", () => {
        expect(hasOwnerRole("owner")).toBe(true);
        expect(hasOwnerRole("member,owner")).toBe(true);
        expect(hasOwnerRole("admin,member")).toBe(false);
        expect(hasOwnerRole("")).toBe(false);
    });
});

describe("roleCovers", () => {
    it("holds for owner over admin, but not the reverse", () => {
        expect(roleCovers("owner", "admin")).toBe(true);
        expect(roleCovers("admin", "owner")).toBe(false);
    });

    it("holds for admin over member, but not the reverse", () => {
        expect(roleCovers("admin", "member")).toBe(true);
        expect(roleCovers("member", "admin")).toBe(false);
    });

    it("does not reach across modules", () => {
        expect(roleCovers("skills-admin", "skills-author")).toBe(false);
        expect(roleCovers("i3-admin", "skills-reporter")).toBe(false);
    });
});
