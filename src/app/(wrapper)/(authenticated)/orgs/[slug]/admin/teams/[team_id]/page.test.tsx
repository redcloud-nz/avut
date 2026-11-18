/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Role } from "@/lib/permissions";
import { TeamId } from "@/lib/schemas/team";

import AdminModule_Team_Page from "./page";

const mocks = vi.hoisted(() => ({
    prefetch: vi.fn(),
    requireOrganization: vi.fn(),
}));

// Each `queryOptions` call returns a tag naming its procedure, so the test can tell the
// prefetches apart without the real router.
vi.mock("@/trpc/server", () => ({
    fetchQuery: vi.fn(),
    HydrateClient: ({ children }: { children: React.ReactNode }) => children,
    prefetch: mocks.prefetch,
    trpc: {
        teams: { getTeam: { queryOptions: (input: unknown) => ["teams.getTeam", input] } },
        teamUsers: {
            listTeamUsers: {
                queryOptions: (input: unknown) => ["teamUsers.listTeamUsers", input],
            },
        },
    },
}));
vi.mock("@/server/organization-access", () => ({
    requireOrganization: mocks.requireOrganization,
}));
vi.mock("@/server/cache/organization", () => ({ getOrganizationBySlug: vi.fn() }));
vi.mock("@/modules/org-admin/components/teams/team-content", () => ({
    AdminModule_Team_Content: () => null,
}));

const TEAM = TeamId.create();
const ORG = "org-1";

async function renderPageAs(roles: Role[]) {
    mocks.requireOrganization.mockResolvedValue({ organization: { id: ORG }, roles });
    await AdminModule_Team_Page({
        params: Promise.resolve({ slug: "acme", team_id: TEAM }),
        searchParams: Promise.resolve({}),
    });
    return mocks.prefetch.mock.calls.map(([options]) => (options as [string])[0]);
}

describe("AdminModule_Team_Page", () => {
    beforeEach(() => {
        mocks.prefetch.mockReset();
    });

    it("prefetches the team's access list for a caller who can view members", async () => {
        expect(await renderPageAs(["admin"])).toEqual(["teams.getTeam", "teamUsers.listTeamUsers"]);
    });

    it("skips the access list for a caller who can't view members", async () => {
        expect(await renderPageAs(["skills-assessor"])).toEqual(["teams.getTeam"]);
    });
});
