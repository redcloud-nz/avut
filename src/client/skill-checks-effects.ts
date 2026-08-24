/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { write } from "@/trpc/mutation-invalidator";
import { trpc } from "@/trpc/client";
import type { RouterInput, RouterOutput } from "@/trpc/routers/_app";

/**
 * Cache effects for `skillChecks` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * No procedure in this router currently needs a list-level `invalidate()`, so this file only
 * covers the one detail-query write.
 */
export const skillChecksEffects = {
    approveSession: (
        vars: RouterInput["skillChecks"]["approveSession"],
        { updated }: RouterOutput["skillChecks"]["approveSession"],
    ) => [
        write(
            trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.sessionId,
            }),
            (old) => (old ? { ...old, ...updated } : old),
        ),
    ],
} as const;
