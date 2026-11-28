/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOptionalTeam } from "@/hooks/use-team";
import type { TeamData } from "@/lib/schemas/team";

/** Which scope a Skill Track component renders in, with the team when it's team scope. */
export type SkillTrackScope = { scope: "team"; team: TeamData } | { scope: "organization" };

/**
 * The scope a Skill Track component shared between the org and team scopes renders in: team
 * scope under a `TeamProvider`, otherwise org scope. Outside both (e.g. the `/docs` demos) it
 * also reads as org scope, though the components the demos render shouldn't call it.
 */
export function useSkillTrackScope(): SkillTrackScope {
    const team = useOptionalTeam();
    return team ? { scope: "team", team } : { scope: "organization" };
}
