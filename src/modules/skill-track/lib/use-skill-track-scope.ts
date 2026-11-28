/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useMemo } from "react";

import { useOptionalTeam } from "@/hooks/use-team";
import type { TeamData } from "@/lib/schemas/team";

/** Which scope a Skill Track component renders in, with the team when it's team scope. */
export type SkillTrackScope = { scope: "team"; team: TeamData } | { scope: "organization" };

const ORG_SCOPE: SkillTrackScope = { scope: "organization" };

/**
 * The scope a Skill Track component shared between the org and team scopes renders in: team
 * scope under a `TeamProvider`, otherwise org scope. Outside both (e.g. the `/docs` demos) it
 * also reads as org scope, though the components the demos render shouldn't call it.
 *
 * The result stays the same object while the team does, so it can be an effect or memo
 * dependency.
 */
export function useSkillTrackScope(): SkillTrackScope {
    const team = useOptionalTeam();
    return useMemo(() => (team ? { scope: "team", team } : ORG_SCOPE), [team]);
}
