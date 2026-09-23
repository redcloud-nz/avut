/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Role } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";

import { requireOrganizationWith } from "./organization-access";

const mocks = vi.hoisted(() => ({
    forbidden: vi.fn(() => {
        // The real `forbidden()` signals by throwing a sentinel, so it never returns.
        throw new Error("NEXT_FORBIDDEN");
    }),
    requireSession: vi.fn(),
    getOrganizationBySlug: vi.fn(),
    getOrganizationSettings: vi.fn(),
    getOrganizationUserRoles: vi.fn(),
    hasAnyRoleWithPermissions: vi.fn(),
}));

vi.mock("@/lib/permissions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/permissions")>();
    return { ...actual, hasAnyRoleWithPermissions: mocks.hasAnyRoleWithPermissions };
});
vi.mock("next/navigation", () => ({ forbidden: mocks.forbidden }));
vi.mock("./session", () => ({ requireSession: mocks.requireSession }));
vi.mock("./cache/organization", () => ({ getOrganizationBySlug: mocks.getOrganizationBySlug }));
vi.mock("./cache/organization-settings", () => ({
    getOrganizationSettings: mocks.getOrganizationSettings,
}));
vi.mock("./cache/organization-user", () => ({
    getOrganizationUserRoles: mocks.getOrganizationUserRoles,
}));

describe("requireOrganizationWith", () => {
    const orgId = OrganizationId.create();
    const userId = UserId.create();

    function asRoles(roles: Role[]) {
        mocks.getOrganizationUserRoles.mockResolvedValue(roles);
    }

    beforeEach(async () => {
        vi.clearAllMocks();
        // `@/lib/permissions` is mocked above so the calls can be inspected; the real check still runs.
        const actual =
            await vi.importActual<typeof import("@/lib/permissions")>("@/lib/permissions");
        mocks.hasAnyRoleWithPermissions.mockImplementation(actual.hasAnyRoleWithPermissions);
        mocks.requireSession.mockResolvedValue({ user: { id: userId } });
        mocks.getOrganizationBySlug.mockResolvedValue({ id: orgId, slug: "acme" });
        mocks.getOrganizationSettings.mockResolvedValue({});
    });

    it("returns the access when a role grants every requested permission", async () => {
        asRoles(["admin"]);

        const access = await requireOrganizationWith("acme", { person: ["update"] });

        expect(access.roles).toEqual(["admin"]);
        expect(mocks.forbidden).not.toHaveBeenCalled();
    });

    it("calls forbidden() when no role grants the permission", async () => {
        asRoles(["member"]);

        await expect(requireOrganizationWith("acme", { person: ["update"] })).rejects.toThrow(
            "NEXT_FORBIDDEN",
        );
        expect(mocks.forbidden).toHaveBeenCalledOnce();
    });

    it("denies when the permissions are only covered by a union of roles, not by any single one", async () => {
        // `i3-editor` holds i3Item:issue, `member` holds team:view — neither holds both.
        asRoles(["i3-editor", "member"]);

        await expect(
            requireOrganizationWith("acme", { i3Item: ["issue"], team: ["view"] }),
        ).rejects.toThrow("NEXT_FORBIDDEN");
    });

    it("grants when any one of several roles covers the request", async () => {
        asRoles(["member", "admin"]);

        await expect(
            requireOrganizationWith("acme", { person: ["update"] }),
        ).resolves.toBeDefined();
    });

    it("always requires organization:view, even when the caller didn't ask for it", async () => {
        asRoles(["admin"]);

        await requireOrganizationWith("acme", { person: ["update"] });

        expect(mocks.hasAnyRoleWithPermissions).toHaveBeenCalledWith(["admin"], {
            person: ["update"],
            organization: ["view"],
        });
    });

    it("appends view to an existing organization list, and doesn't duplicate it", async () => {
        asRoles(["admin"]);

        await requireOrganizationWith("acme", { organization: ["update"] });
        await requireOrganizationWith("acme", { organization: ["view", "update"] });

        expect(mocks.hasAnyRoleWithPermissions).toHaveBeenNthCalledWith(1, ["admin"], {
            organization: ["update", "view"],
        });
        expect(mocks.hasAnyRoleWithPermissions).toHaveBeenNthCalledWith(2, ["admin"], {
            organization: ["view", "update"],
        });
    });

    it("denies an owner-only action to an admin", async () => {
        asRoles(["admin"]);

        await expect(requireOrganizationWith("acme", { organization: ["delete"] })).rejects.toThrow(
            "NEXT_FORBIDDEN",
        );
    });
});
