/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "@/lib/errors";
import { fetchD4HWhoami } from "@/server/d4h-api/client";

import { requireD4HTeamPermission } from "./d4h-permissions";

vi.mock("@/server/d4h-api/client", () => ({
    fetchD4HWhoami: vi.fn(),
    fetchD4HWhoamiCached: vi.fn(),
}));

const TEAM_ID = 7;

/** The resolved token `getConfiguredD4HAccessToken` hands back. */
const accessToken = { id: "token-1", serverCode: "us", token: "secret" } as never;

/** A whoami holding one membership, in team `teamId`, with the given permissions. */
function whoami(teamId: number, permissions: Record<string, Record<string, boolean>>) {
    return {
        account: { id: 1, resourceType: "Account" },
        members: [
            {
                id: 11,
                resourceType: "Member",
                hasAccess: true,
                name: "Member",
                owner: { id: teamId, resourceType: "Team", title: "Rescue Team" },
                permissions,
            },
        ],
    };
}

describe("requireD4HTeamPermission", () => {
    beforeEach(() => {
        vi.mocked(fetchD4HWhoami).mockReset();
    });

    it("resolves when the membership holds the permission", async () => {
        vi.mocked(fetchD4HWhoami).mockResolvedValue(
            whoami(TEAM_ID, { Equipment: { UPDATE: true } }) as never,
        );

        await expect(
            requireD4HTeamPermission(accessToken, TEAM_ID, "Equipment", "UPDATE"),
        ).resolves.toBeUndefined();
        expect(fetchD4HWhoami).toHaveBeenCalledWith(accessToken);
    });

    it("throws ForbiddenError naming the team when the permission is false", async () => {
        vi.mocked(fetchD4HWhoami).mockResolvedValue(
            whoami(TEAM_ID, { Equipment: { UPDATE: false } }) as never,
        );

        const result = requireD4HTeamPermission(accessToken, TEAM_ID, "Equipment", "UPDATE");
        await expect(result).rejects.toBeInstanceOf(ForbiddenError);
        await expect(result).rejects.toThrow(
            "You need D4H's Equipment UPDATE permission on Rescue Team to do this.",
        );
    });

    it("throws ForbiddenError when the permission is missing", async () => {
        vi.mocked(fetchD4HWhoami).mockResolvedValue(
            whoami(TEAM_ID, { Equipment: { CREATE: true } }) as never,
        );

        await expect(
            requireD4HTeamPermission(accessToken, TEAM_ID, "Equipment", "RETIRE"),
        ).rejects.toThrow("You need D4H's Equipment RETIRE permission on Rescue Team to do this.");
    });

    it("throws ForbiddenError naming the team id when there's no membership in the team", async () => {
        vi.mocked(fetchD4HWhoami).mockResolvedValue(
            whoami(99, { Equipment: { CREATE: true } }) as never,
        );

        const result = requireD4HTeamPermission(accessToken, TEAM_ID, "Equipment", "CREATE");
        await expect(result).rejects.toBeInstanceOf(ForbiddenError);
        await expect(result).rejects.toThrow(
            "You need D4H's Equipment CREATE permission on team 7 to do this.",
        );
    });
});
