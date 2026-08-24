/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import type { RouterInput, RouterOutput } from "@/trpc/routers/_app";

type Session = RouterOutput["skills"]["getSession"];

/**
 * Direct cache writes for `skillChecks` router mutations, keyed by procedure name.
 *
 * Passed as `meta.writes` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * There's no `skill-checks-invalidations.ts` sibling yet — no procedure in this router currently
 * declares `meta.invalidates` — so this file only covers the one detail-query write.
 */
export const skillChecksWrites = {
    approveSession: (
        vars: RouterInput["skillChecks"]["approveSession"],
        { updated }: RouterOutput["skillChecks"]["approveSession"],
    ) => [
        {
            queryKey: trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.sessionId,
            }),
            data: (old: Session | undefined) => (old ? { ...old, ...updated } : old),
        },
    ],
} as const;
