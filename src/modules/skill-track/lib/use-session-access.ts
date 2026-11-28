/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import type { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { useSkillTrackScope } from "@/modules/skill-track/lib/use-skill-track-scope";

/** What the current scope may change on a session. */
export interface SessionAccess {
    /**
     * In team scope, the session belongs to another team or to none (an org session). Nothing on
     * it can be changed from here: it's view only, and its edits stay in the org scope.
     */
    foreign: boolean;
    /** Its checks and config can't be changed here: it's approved, or `foreign`. */
    locked: boolean;
}

/**
 * Whether a session's pages may change it in the current scope. An approved session is locked
 * until it's reopened. In team scope, another team's (or a team-less) session is `foreign`, and
 * so locked too, approved or not; in org scope no session is foreign.
 *
 * UI only: the org procedures still accept writes to a foreign session, as team scope has no
 * server-side team context yet (#528).
 */
export function useSessionAccess(
    session: Pick<SkillCheckSession, "status" | "teamId">,
): SessionAccess {
    const scope = useSkillTrackScope();
    const foreign = scope.scope === "team" && session.teamId !== scope.team.id;
    return { foreign, locked: foreign || session.status === "Include" };
}
