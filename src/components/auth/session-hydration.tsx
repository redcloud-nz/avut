/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { ReactNode } from "react";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { ensureSession } from "@/server/auth-queries";
import { getQueryClient } from "@/trpc/query-client";

/**
 * Seed the React Query cache with the current session so client descendants calling
 * `useSession()` render it on first paint — no pending state, no auth flash, no duplicate
 * fetch on mount.
 *
 * Hydration is per-subtree: a client component outside this boundary fetches from scratch,
 * so this belongs in the nearest server ancestor of whatever reads the session.
 */
export async function SessionHydration({ children }: { children: ReactNode }) {
    const queryClient = getQueryClient();
    await ensureSession(queryClient);

    return <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>;
}
