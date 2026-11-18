/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { I3Bundle } from "@/lib/schemas/i3-bundle";
import { trpc } from "@/trpc/client";
import { createEffects, invalidate, write } from "@/trpc/mutation-effector";

/** Write `bundle` into its cached `getBundle` entry, keeping the cached lines. */
function writeBundle(organizationId: string, bundle: I3Bundle) {
    return write(
        trpc.i3Bundles.getBundle.queryKey({ organizationId, bundleId: bundle.id }),
        (old) => (old ? { ...old, bundle } : old),
    );
}

/**
 * Cache effects for `i3Bundles` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const i3BundlesEffects = createEffects<"i3Bundles">()({
    // Adding or removing lines changes the lines `getBundle` returns, so it is refetched.
    addTemplates: ({ organizationId, bundleId }) => [
        invalidate(trpc.i3Bundles.listBundles.queryFilter({ organizationId })),
        invalidate(trpc.i3Bundles.getBundle.queryFilter({ organizationId, bundleId })),
    ],
    createBundle: ({ organizationId }) => [
        invalidate(trpc.i3Bundles.listBundles.queryFilter({ organizationId })),
    ],
    deleteBundle: ({ organizationId }, { deleted }) => [
        writeBundle(organizationId, deleted),
        invalidate(trpc.i3Bundles.listBundles.queryFilter({ organizationId })),
    ],
    recoverBundle: ({ organizationId }, { updated }) => [
        writeBundle(organizationId, updated),
        invalidate(trpc.i3Bundles.listBundles.queryFilter({ organizationId })),
    ],
    removeTemplate: ({ organizationId, bundleId }) => [
        invalidate(trpc.i3Bundles.listBundles.queryFilter({ organizationId })),
        invalidate(trpc.i3Bundles.getBundle.queryFilter({ organizationId, bundleId })),
    ],
    updateBundle: ({ organizationId }, { updated }) => [
        writeBundle(organizationId, updated),
        invalidate(trpc.i3Bundles.listBundles.queryFilter({ organizationId })),
    ],
});
