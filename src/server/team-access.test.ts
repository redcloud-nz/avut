/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";

import { requireTeam } from "./team-access";

const mocks = vi.hoisted(() => ({
    notFound: vi.fn(() => {
        // The real `notFound()` signals by throwing a sentinel, so it never returns.
        throw new Error("NEXT_NOT_FOUND");
    }),
    requireSession: vi.fn(),
    getTeamBySlug: vi.fn(),
    getOrganizationSettings: vi.fn(),
    getOrganizationUserRoles: vi.fn(),
    teamUserFindUnique: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./prisma", () => ({ default: { teamUser: { findUnique: mocks.teamUserFindUnique } } }));
vi.mock("./session", () => ({ requireSession: mocks.requireSession }));
vi.mock("./cache/team", () => ({ getTeamBySlug: mocks.getTeamBySlug }));
vi.mock("./cache/organization-settings", () => ({
    getOrganizationSettings: mocks.getOrganizationSettings,
}));
vi.mock("./cache/organization-user", () => ({
    getOrganizationUserRoles: mocks.getOrganizationUserRoles,
}));

const orgId = OrganizationId.create();
const teamId = TeamId.create();
const userId = UserId.create();

const organization = { id: orgId, name: "Acme", slug: "acme" };
const settings = { modules: {} };

function teamRow(status: "Active" | "Archived" | "Deleted" = "Active") {
    return {
        id: teamId,
        name: "Alpha",
        slug: "alpha",
        description: "",
        status,
        organizationId: orgId,
        d4h: null,
    };
}

describe("requireTeam", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireSession.mockResolvedValue({ user: { id: userId } });
        mocks.getOrganizationSettings.mockResolvedValue(settings);
        mocks.getOrganizationUserRoles.mockResolvedValue(["member"]);
        mocks.teamUserFindUnique.mockResolvedValue({ team: { status: "Active", slug: "alpha" } });
    });

    it("returns the team, its org, settings and the caller's roles for a granted Active team", async () => {
        mocks.getTeamBySlug.mockResolvedValue({ ...teamRow(), organization });

        const access = await requireTeam("alpha");

        expect(access).toEqual({
            session: { user: { id: userId } },
            team: teamRow(),
            organization,
            settings,
            roles: ["member"],
        });
        expect(mocks.getTeamBySlug).toHaveBeenCalledWith("alpha");
        expect(mocks.getOrganizationSettings).toHaveBeenCalledWith(orgId);
        expect(mocks.getOrganizationUserRoles).toHaveBeenCalledWith(orgId, userId);
        expect(mocks.teamUserFindUnique).toHaveBeenCalledWith({
            where: { teamId_userId: { teamId, userId } },
            select: { team: { select: { status: true, slug: true } } },
        });
        expect(mocks.notFound).not.toHaveBeenCalled();
    });

    it.each(["Archived", "Deleted"] as const)(
        "calls notFound() for a %s team without checking the grant",
        async (status) => {
            mocks.getTeamBySlug.mockResolvedValue({ ...teamRow(status), organization });

            await expect(requireTeam(`team-${status}`)).rejects.toThrow("NEXT_NOT_FOUND");
            expect(mocks.notFound).toHaveBeenCalledOnce();
            expect(mocks.teamUserFindUnique).not.toHaveBeenCalled();
            expect(mocks.getOrganizationUserRoles).not.toHaveBeenCalled();
        },
    );

    it("calls notFound() when the caller holds no grant on the team", async () => {
        mocks.getTeamBySlug.mockResolvedValue({ ...teamRow(), organization });
        mocks.teamUserFindUnique.mockResolvedValue(null);

        await expect(requireTeam("ungranted")).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mocks.notFound).toHaveBeenCalledOnce();
    });

    // The cached team is only an early exit: a missed `revalidateTeam` mustn't let anyone into a
    // team archived or deleted since it was cached.
    it.each(["Archived", "Deleted"] as const)(
        "calls notFound() for a team cached as Active but %s by the uncached grant query",
        async (status) => {
            mocks.getTeamBySlug.mockResolvedValue({ ...teamRow("Active"), organization });
            mocks.teamUserFindUnique.mockResolvedValue({ team: { status, slug: "alpha" } });

            await expect(requireTeam(`stale-${status}`)).rejects.toThrow("NEXT_NOT_FOUND");
            expect(mocks.notFound).toHaveBeenCalledOnce();
        },
    );

    // A rename whose old-slug entry wasn't cleared: the cache still maps the old slug to the team,
    // but the uncached grant query reads its new slug.
    it("calls notFound() for a team cached under a slug it no longer has", async () => {
        mocks.getTeamBySlug.mockResolvedValue({ ...teamRow(), organization });
        mocks.teamUserFindUnique.mockResolvedValue({ team: { status: "Active", slug: "renamed" } });

        await expect(requireTeam("alpha")).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mocks.notFound).toHaveBeenCalledOnce();
    });

    it("checks the grant alongside the settings and roles, not after them", async () => {
        mocks.getTeamBySlug.mockResolvedValue({ ...teamRow(), organization });
        let releaseSettings!: (value: unknown) => void;
        mocks.getOrganizationSettings.mockReturnValue(
            new Promise((resolve) => (releaseSettings = resolve)),
        );
        let releaseRoles!: (value: unknown) => void;
        mocks.getOrganizationUserRoles.mockReturnValue(
            new Promise((resolve) => (releaseRoles = resolve)),
        );

        const pending = requireTeam("alpha");
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Settings and roles are still unresolved, yet the grant query has been issued.
        expect(mocks.teamUserFindUnique).toHaveBeenCalledOnce();

        releaseSettings(settings);
        releaseRoles(["member"]);
        await expect(pending).resolves.toMatchObject({ roles: ["member"] });
    });
});
