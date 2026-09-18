/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { TRPCError } from "@trpc/server";

import { assertHasPermissionResult, hasAnyRoleWithPermissions } from "./permissions";

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
});

describe("assertHasPermissionResult", () => {
    it("passes when the permission was granted", () => {
        expect(() =>
            assertHasPermissionResult({ success: true }, { person: ["delete"] }),
        ).not.toThrow();
    });

    // Better Auth returns `{ success: false }` — rather than throwing — when the user is a
    // member of the organization but lacks the permission. Ignoring the flag grants every
    // permission to every member, so this is the regression that matters.
    it("throws FORBIDDEN when the permission was denied", () => {
        expect(() => assertHasPermissionResult({ success: false }, { person: ["delete"] })).toThrow(
            TRPCError,
        );

        try {
            assertHasPermissionResult({ success: false }, { person: ["delete"] });
            expect.unreachable("should have thrown");
        } catch (error) {
            expect((error as TRPCError).code).toBe("FORBIDDEN");
            expect((error as TRPCError).message).toContain('{"person":["delete"]}');
        }
    });
});
