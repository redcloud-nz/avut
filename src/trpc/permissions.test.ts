/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { TRPCError } from "@trpc/server";

import { assertHasPermissionResult } from "./permissions";

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
