/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";

import { getGrantedTeam, requireTeam } from "./team-access";

const mocks = vi.hoisted(() => ({
    notFound: vi.fn(() => {
        // The real `notFound()` signals by throwing a sentinel, so it never returns.
        throw new Error("NEXT_NOT_FOUND");
    }),
    requireSession: vi.fn(),
    getSession: vi.fn(),
    getGrantedBySlug: vi.fn(),
    getOrganizationBySlug: vi.fn(),
    getOrganizationSettings: vi.fn(),
    getOrganizationUserRoles: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./prisma", () => ({ default: {} }));
vi.mock("./session", () => ({
    getSession: mocks.getSession,
    requireSession: mocks.requireSession,
}));
vi.mock("./services/teams", () => ({ getGrantedBySlug: mocks.getGrantedBySlug }));
vi.mock("./cache/organization", () => ({ getOrganizationBySlug: mocks.getOrganizationBySlug }));
vi.mock("./cache/organization-settings", () => ({
    getOrganizationSettings: mocks.getOrganizationSettings,
}));
vi.mock("./cache/organization-user", () => ({
    getOrganizationUserRoles: mocks.getOrganizationUserRoles,
}));

const orgId = OrganizationId.create();
const teamId = TeamId.create();
const userId = UserId.create();

const team = {
    id: teamId,
    name: "Alpha",
    slug: "alpha",
    description: "",
    organization: { id: orgId, name: "Acme", slug: "acme" },
    d4h: null,
};

describe("requireTeam", () => {
    const organization = { id: orgId, name: "Acme", slug: "acme" };
    const settings = { modules: {} };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireSession.mockResolvedValue({ user: { id: userId } });
        mocks.getSession.mockResolvedValue({ user: { id: userId } });
        mocks.getOrganizationBySlug.mockResolvedValue(organization);
        mocks.getOrganizationSettings.mockResolvedValue(settings);
        mocks.getOrganizationUserRoles.mockResolvedValue(["member"]);
    });

    it("returns the team, its org, settings and the caller's roles when granted", async () => {
        mocks.getGrantedBySlug.mockResolvedValue(team);

        const access = await requireTeam("alpha");

        expect(access).toEqual({
            session: { user: { id: userId } },
            team,
            organization,
            settings,
            roles: ["member"],
        });
        expect(mocks.getGrantedBySlug).toHaveBeenCalledWith(expect.anything(), "alpha", userId);
        // The org comes from the cached helper, keyed on the team's org.
        expect(mocks.getOrganizationBySlug).toHaveBeenCalledWith("acme");
        expect(mocks.getOrganizationSettings).toHaveBeenCalledWith(orgId);
        expect(mocks.getOrganizationUserRoles).toHaveBeenCalledWith(orgId, userId);
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    it("calls notFound() and loads nothing else when the access check returns null", async () => {
        mocks.getGrantedBySlug.mockResolvedValue(null);

        await expect(requireTeam("nobody")).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mocks.notFound).toHaveBeenCalledOnce();
        expect(mocks.getOrganizationBySlug).not.toHaveBeenCalled();
        expect(mocks.getOrganizationSettings).not.toHaveBeenCalled();
        expect(mocks.getOrganizationUserRoles).not.toHaveBeenCalled();
    });
});

describe("getGrantedTeam", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the granted team for the session's user", async () => {
        mocks.getSession.mockResolvedValue({ user: { id: userId } });
        mocks.getGrantedBySlug.mockResolvedValue(team);

        await expect(getGrantedTeam("alpha")).resolves.toEqual(team);
        expect(mocks.getGrantedBySlug).toHaveBeenCalledWith(expect.anything(), "alpha", userId);
    });

    it("returns null for an ungranted slug, without calling notFound()", async () => {
        mocks.getSession.mockResolvedValue({ user: { id: userId } });
        mocks.getGrantedBySlug.mockResolvedValue(null);

        await expect(getGrantedTeam("nobody")).resolves.toBeNull();
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    it("returns null without querying when there's no session", async () => {
        mocks.getSession.mockResolvedValue(null);

        await expect(getGrantedTeam("alpha")).resolves.toBeNull();
        expect(mocks.getGrantedBySlug).not.toHaveBeenCalled();
        expect(mocks.requireSession).not.toHaveBeenCalled();
    });
});
