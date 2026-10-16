/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, write } from "@/trpc/mutation-effector";

/**
 * Cache effects for `whatsNew` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const whatsNewEffects = createEffects<"whatsNew">()({
    // The dialog marks every entry it showed as seen, so nothing is left unseen. A write rather
    // than an invalidate: the footer button's dot clears at once, with no refetch.
    markSeen: () => [write(trpc.whatsNew.getUnseen.queryKey(), { entries: [] })],
});
