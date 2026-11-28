/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { renderHook } from "@testing-library/react";

import { TeamProvider } from "@/hooks/use-team";
import { OrganizationId } from "@/lib/schemas/organization";
import type { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { TeamData, TeamId } from "@/lib/schemas/team";

import { useSessionAccess } from "./use-session-access";

const team = TeamData.schema.parse({
    id: TeamId.create(),
    name: "Rescue Team",
    slug: "rescue",
    description: "",
    tags: [],
    properties: {},
    organizationId: OrganizationId.create(),
    createdAt: new Date().toISOString(),
    updatedAt: null,
    d4h: null,
});
const otherTeamId = TeamId.create();

type Session = Pick<SkillCheckSession, "status" | "teamId">;

const inTeamScope = ({ children }: { children: ReactNode }) => (
    <TeamProvider team={team} teamSlug="rescue">
        {children}
    </TeamProvider>
);

function accessInTeamScope(session: Session) {
    return renderHook(() => useSessionAccess(session), { wrapper: inTeamScope }).result.current;
}

// Org scope has no TeamProvider.
function accessInOrgScope(session: Session) {
    return renderHook(() => useSessionAccess(session)).result.current;
}

describe("useSessionAccess", () => {
    describe("in org scope", () => {
        it.each([
            ["a team's", team.id],
            ["a team-less", null],
        ])("leaves %s draft session open", (_, teamId) => {
            expect(accessInOrgScope({ status: "Draft", teamId })).toEqual({
                foreign: false,
                locked: false,
            });
        });

        it("locks an approved session", () => {
            expect(accessInOrgScope({ status: "Include", teamId: null })).toEqual({
                foreign: false,
                locked: true,
            });
        });
    });

    describe("in team scope", () => {
        it("leaves the team's own draft session open", () => {
            expect(accessInTeamScope({ status: "Draft", teamId: team.id })).toEqual({
                foreign: false,
                locked: false,
            });
        });

        it("locks the team's own approved session without making it foreign", () => {
            expect(accessInTeamScope({ status: "Include", teamId: team.id })).toEqual({
                foreign: false,
                locked: true,
            });
        });

        it.each([
            ["another team's", otherTeamId],
            ["a team-less", null],
        ])("makes %s session foreign and locked", (_, teamId) => {
            expect(accessInTeamScope({ status: "Draft", teamId })).toEqual({
                foreign: true,
                locked: true,
            });
            expect(accessInTeamScope({ status: "Include", teamId })).toEqual({
                foreign: true,
                locked: true,
            });
        });
    });
});
