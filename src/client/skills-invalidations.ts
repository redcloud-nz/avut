/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import type { RouterInput } from "@/trpc/routers/_app";

/**
 * Cache invalidations for `skills` router mutations, keyed by procedure name.
 *
 * Passed as `meta.invalidates` on the corresponding `useMutation` call — see
 * `MutationInvalidator`. Covers list-level queries only; detail/scoped queries
 * (`getSession`, `listSessionAssessees`/`listSessionSkills` with `scope: "assigned"`) are synced
 * directly via `setQueryData` at each call site instead — see
 * `docs/patterns/detail-page-data-fetching.md`.
 */
export const skillsInvalidations = {
    createSession: (vars: RouterInput["skills"]["createSession"]) => [
        trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId }),
    ],
    deleteSession: (vars: RouterInput["skills"]["deleteSession"]) => [
        trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId }),
    ],
    subscribeToPackage: (vars: RouterInput["skills"]["subscribeToPackage"]) => [
        trpc.skills.listPackages.queryFilter({ organizationId: vars.organizationId }),
    ],
    unsubscribeFromPackage: (vars: RouterInput["skills"]["unsubscribeFromPackage"]) => [
        trpc.skills.listPackages.queryFilter({ organizationId: vars.organizationId }),
    ],
    updateSession: (vars: RouterInput["skills"]["updateSession"]) => [
        trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId }),
    ],
    updateSessionAssessees: (vars: RouterInput["skills"]["updateSessionAssessees"]) => [
        trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId }),
        trpc.skills.listSessionAssessees.queryFilter({
            organizationId: vars.organizationId,
            sessionId: vars.skillCheckSessionId,
            scope: "all",
        }),
    ],
    updateSessionSkills: (vars: RouterInput["skills"]["updateSessionSkills"]) => [
        trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId }),
        trpc.skills.listSessionAssessees.queryFilter({
            organizationId: vars.organizationId,
            sessionId: vars.skillCheckSessionId,
            scope: "all",
        }),
    ],
} as const;
