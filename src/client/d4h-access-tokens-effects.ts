/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `d4hAccessTokens` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const d4hAccessTokensEffects = createEffects<"d4hAccessTokens">()({
    createOrganizationAccessToken: (vars) => [
        invalidate(
            trpc.d4hAccessTokens.listOrganizationAccessTokens.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    createPersonalAccessToken: () => [
        invalidate(trpc.d4hAccessTokens.listPersonalAccessTokens.queryFilter()),
    ],
    // Delete also clears the `modules.d4h-nag.d4hTokenId` and `integrations.d4h.syncToken`
    // settings that pointed at the token.
    deleteOrganizationAccessToken: (vars) => [
        invalidate(
            trpc.d4hAccessTokens.listOrganizationAccessTokens.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(
            trpc.settings.getOrganizationSettings.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    deletePersonalAccessToken: () => [
        invalidate(trpc.d4hAccessTokens.listPersonalAccessTokens.queryFilter()),
    ],
    refreshPersonalAccessToken: (vars) => [
        invalidate(trpc.d4hAccessTokens.listPersonalAccessTokens.queryFilter()),
        invalidate(
            trpc.d4hAccessTokens.getPersonalAccessToken.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    refreshToken: (vars) => [
        invalidate(
            trpc.d4hAccessTokens.getOrganizationAccessToken.queryFilter({
                organizationId: vars.organizationId,
                tokenId: vars.tokenId,
            }),
        ),
    ],
    replaceOrganizationAccessToken: (vars) => [
        invalidate(
            trpc.d4hAccessTokens.listOrganizationAccessTokens.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(
            trpc.d4hAccessTokens.getOrganizationAccessToken.queryFilter({
                organizationId: vars.organizationId,
                tokenId: vars.tokenId,
            }),
        ),
    ],
    updateOrganizationAccessToken: (vars) => [
        invalidate(
            trpc.d4hAccessTokens.listOrganizationAccessTokens.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(
            trpc.d4hAccessTokens.getOrganizationAccessToken.queryFilter({
                organizationId: vars.organizationId,
                tokenId: vars.tokenId,
            }),
        ),
    ],
});
