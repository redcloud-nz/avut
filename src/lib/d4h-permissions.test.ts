/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { hasD4HTeamPermission } from "./d4h-permissions";

describe("hasD4HTeamPermission", () => {
    it("is true when the permission is granted", () => {
        expect(hasD4HTeamPermission({ Equipment: { UPDATE: true } }, "Equipment", "UPDATE")).toBe(
            true,
        );
    });

    it("is false when the permission is false", () => {
        expect(hasD4HTeamPermission({ Equipment: { UPDATE: false } }, "Equipment", "UPDATE")).toBe(
            false,
        );
    });

    it("is false when the action is missing", () => {
        expect(hasD4HTeamPermission({ Equipment: { CREATE: true } }, "Equipment", "RETIRE")).toBe(
            false,
        );
    });

    it("is false when the resource is missing", () => {
        expect(hasD4HTeamPermission({ Member: { UPDATE: true } }, "Equipment", "UPDATE")).toBe(
            false,
        );
    });

    it("is false with no permissions record", () => {
        expect(hasD4HTeamPermission(undefined, "Equipment", "CREATE")).toBe(false);
    });
});
