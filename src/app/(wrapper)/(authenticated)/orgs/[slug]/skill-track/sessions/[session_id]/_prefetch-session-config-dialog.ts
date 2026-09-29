/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { SessionConfigAction } from "@/components/skill-track/session-config-dialogs";
import { OrganizationId } from "@/lib/schemas/organization";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { prefetch, trpc } from "@/trpc/server";

/**
 * Prefetches the queries of the session config dialog that `?action=` names, if any, for a page
 * that mounts `SkillTrack_SessionConfigDialogs`. A dialog's lists are only needed on the first
 * render when it opens on arrival; otherwise it fetches them itself once opened.
 *
 * The session's assigned assessees and skills are left out: every page that hosts the dialogs
 * reads them itself and prefetches them unconditionally.
 */
export function prefetchSessionConfigDialog({
    action,
    organizationId,
    sessionId,
}: {
    action: string | string[] | undefined;
    organizationId: OrganizationId;
    sessionId: SkillCheckSessionId;
}) {
    // Only the literals are compared below, so an unknown value just matches no case.
    switch (action as SessionConfigAction | undefined) {
        case "change-personnel":
            prefetch(trpc.teams.listTeams.queryOptions({ organizationId }));
            prefetch(trpc.teams.listTeamMemberships.queryOptions({ organizationId }));
            break;
        case "change-skills":
            prefetch(
                trpc.skillPackageSubscriptions.listAssessableSkills.queryOptions({
                    organizationId,
                }),
            );
            break;
        case "change-assessors":
            prefetch(
                trpc.skillCheckSessions.listEligibleAssessors.queryOptions({ organizationId }),
            );
            prefetch(
                trpc.skillCheckSessions.listSessionAssessors.queryOptions({
                    organizationId,
                    sessionId,
                    scope: "assigned",
                }),
            );
            prefetch(trpc.personnel.getPersonSelf.queryOptions({ organizationId }));
            break;
    }
}
