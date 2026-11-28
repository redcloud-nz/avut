/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { renderHook } from "@testing-library/react";

import { TeamProvider } from "@/hooks/use-team";
import { OrganizationId } from "@/lib/schemas/organization";
import { TeamData, TeamId } from "@/lib/schemas/team";

import { useSkillTrackScope } from "./use-skill-track-scope";

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

describe("useSkillTrackScope", () => {
    it("is team scope, with the team, under a TeamProvider", () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <TeamProvider team={team} teamSlug="rescue">
                {children}
            </TeamProvider>
        );
        expect(renderHook(() => useSkillTrackScope(), { wrapper }).result.current).toEqual({
            scope: "team",
            team,
        });
    });

    // Org scope has no TeamProvider, and neither has a page outside both scopes (the `/docs`
    // demos): both read as org scope.
    it.each(["org scope", "no scope"])("is org scope in %s", () => {
        expect(renderHook(() => useSkillTrackScope()).result.current).toEqual({
            scope: "organization",
        });
    });
});
