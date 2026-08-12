/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import type { RouterInput } from "@/trpc/routers/_app";

/**
 * Cache invalidations for `teams` router mutations, keyed by procedure name.
 *
 * Passed as `meta.invalidates` on the corresponding `useMutation` call — see
 * `MutationInvalidator`.
 */
export const teamsInvalidations = {
    updateTeam: (vars: RouterInput["teams"]["updateTeam"]) => [
        trpc.teams.listTeams.queryFilter({ organizationId: vars.organizationId }),
    ],
};
