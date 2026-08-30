/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createEffects, invalidate } from "@/trpc/mutation-effector";
import { trpc } from "@/trpc/client";

/**
 * Cache effects for `d4hAccessTokens` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 */
export const d4hAccessTokensEffects = createEffects<"d4hAccessTokens">()({
    refreshToken: (vars) => [
        invalidate(
            trpc.d4hAccessTokens.getOrganizationAccessToken.queryFilter({
                organizationId: vars.organizationId,
                tokenId: vars.tokenId,
            }),
        ),
    ],
});
