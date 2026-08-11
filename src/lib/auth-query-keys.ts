/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { isServer } from "@tanstack/react-query";

import { UserId } from "@/lib/schemas/user";

/**
 * Hierarchical key factory for auth-related queries.
 *
 * Everything nests under `["auth"]` and every per-user read under
 * `["auth", "user", userId]`, so evicting one account's entire cache subtree on sign-out is
 * a single `removeQueries({ queryKey: authQueryKeys.all })`.
 *
 * Deliberately lives in `@/lib` rather than `@/client` so the server-side query factory can
 * produce cache entries under the same keys — that alignment is what makes hydration work.
 */
export const authQueryKeys = {
    all: ["auth"] as const,
    session: ["auth", "session"] as const,
    users: () => [...authQueryKeys.all, "user"] as const,
    user: (userId: UserId) => [...authQueryKeys.users(), userId] as const,
};

/** Status codes worth retrying: transient transport and server-side failures. */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

const MAX_RETRIES = 3;

function statusOf(error: unknown): number | undefined {
    if (typeof error === "object" && error !== null && "status" in error) {
        const status = (error as { status?: unknown }).status;
        if (typeof status === "number") return status;
    }
    return undefined;
}

function retryAfterMsOf(error: unknown): number | undefined {
    if (typeof error === "object" && error !== null && "retryAfterMs" in error) {
        const value = (error as { retryAfterMs?: unknown }).retryAfterMs;
        if (typeof value === "number") return value;
    }
    return undefined;
}

/**
 * Retry policy for auth queries.
 *
 * A missing status means a network-level failure, which is worth retrying. 401/403 are not —
 * an unauthenticated user should fail fast rather than wait out three pointless round trips,
 * which is what React Query's blind default does. Retries are disabled entirely on the
 * server so SSR never sits in a backoff loop.
 */
export const authQueryRetryOptions = {
    retry: (failureCount: number, error: unknown): boolean => {
        if (isServer) return false;
        if (failureCount >= MAX_RETRIES) return false;

        const status = statusOf(error);
        return status === undefined || RETRYABLE_STATUS_CODES.has(status);
    },
    retryDelay: (failureCount: number, error: unknown): number =>
        retryAfterMsOf(error) ?? Math.min(1000 * 2 ** failureCount, 30_000),
};
