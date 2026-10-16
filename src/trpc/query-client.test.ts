/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it, vi } from "vitest";

import { dehydrate } from "@tanstack/react-query";

import { authQueryKeys } from "@/lib/auth-query-keys";

import { trpc } from "./client";
import { makeQueryClient, SESSION_QUERY_KEY_PREFIX, shouldRetryQuery } from "./query-client";

describe("makeQueryClient dehydration", () => {
    // A pending-only predicate silently drops settled queries, which would make every
    // server-side `ensureQueryData` a no-op and send the client back to the network.
    it("dehydrates a settled query", async () => {
        const queryClient = makeQueryClient();

        await queryClient.ensureQueryData({
            queryKey: authQueryKeys.linkedAccounts,
            queryFn: async () => ({ user: { id: "abc" } }),
        });

        const keys = dehydrate(queryClient).queries.map((q) => q.queryKey);
        expect(keys).toContainEqual([...authQueryKeys.linkedAccounts]);
    });

    it("still dehydrates in-flight queries for streaming prefetch", () => {
        const queryClient = makeQueryClient();

        // Deliberately not awaited — leaves the query `pending`.
        void queryClient.prefetchQuery({
            queryKey: ["streaming"],
            queryFn: () => new Promise(() => {}),
        });

        const keys = dehydrate(queryClient).queries.map((q) => q.queryKey);
        expect(keys).toContainEqual(["streaming"]);
    });
});

describe("auth query retry policy", () => {
    it("does not retry an unauthenticated response", () => {
        const queryClient = makeQueryClient();
        const { retry } = queryClient.getQueryDefaults(authQueryKeys.linkedAccounts);

        expect(typeof retry).toBe("function");
        expect((retry as (n: number, e: unknown) => boolean)(0, { status: 401 })).toBe(false);
        expect((retry as (n: number, e: unknown) => boolean)(0, { status: 403 })).toBe(false);
    });

    it("retries transient failures, including network-level ones", () => {
        const queryClient = makeQueryClient();
        const retry = queryClient.getQueryDefaults(authQueryKeys.linkedAccounts).retry as (
            n: number,
            e: unknown,
        ) => boolean;

        expect(retry(0, { status: 503 })).toBe(true);
        expect(retry(0, { status: 429 })).toBe(true);
        expect(retry(0, new Error("network down"))).toBe(true);
    });

    it("gives up after three attempts", () => {
        const queryClient = makeQueryClient();
        const retry = queryClient.getQueryDefaults(authQueryKeys.linkedAccounts).retry as (
            n: number,
            e: unknown,
        ) => boolean;

        expect(retry(3, { status: 503 })).toBe(false);
    });

    it("honours Retry-After when the error carries one", () => {
        const queryClient = makeQueryClient();
        const retryDelay = queryClient.getQueryDefaults(authQueryKeys.linkedAccounts)
            .retryDelay as (n: number, e: unknown) => number;

        expect(retryDelay(0, { retryAfterMs: 4200 })).toBe(4200);
        expect(retryDelay(1, {})).toBe(2000);
        expect(retryDelay(99, {})).toBe(30_000);
    });
});

describe("default query retry policy", () => {
    const trpcError = (httpStatus: number) => ({ data: { httpStatus } });

    it("is the default for every query", () => {
        expect(makeQueryClient().getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);
    });

    it("does not retry a 4xx a retry can't change", () => {
        for (const status of [400, 401, 403, 404, 409]) {
            expect(shouldRetryQuery(0, trpcError(status)), String(status)).toBe(false);
        }
    });

    it("retries server errors, timeouts, rate limits and network failures", () => {
        for (const status of [408, 429, 500, 503]) {
            expect(shouldRetryQuery(0, trpcError(status)), String(status)).toBe(true);
        }
        expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true);
    });

    it("stops after three retries", () => {
        expect(shouldRetryQuery(2, trpcError(500))).toBe(true);
        expect(shouldRetryQuery(3, trpcError(500))).toBe(false);
    });
});

describe("session recheck on UNAUTHORIZED", () => {
    const failWith = (code: string, httpStatus: number) => async () => {
        throw Object.assign(new Error(code), { data: { code, httpStatus } });
    };

    function seededClient() {
        const queryClient = makeQueryClient();
        queryClient.setQueryData([...SESSION_QUERY_KEY_PREFIX, { type: "query" }], {
            user: { id: "u1" },
        });
        const invalidate = vi.spyOn(queryClient, "invalidateQueries");
        return { queryClient, invalidate };
    }

    it("matches the key tRPC gives user.getSession", () => {
        expect(trpc.user.getSession.queryKey()[0]).toEqual(SESSION_QUERY_KEY_PREFIX[0]);
    });

    it("rechecks the session when a query comes back UNAUTHORIZED", async () => {
        const { queryClient, invalidate } = seededClient();

        await queryClient
            .fetchQuery({ queryKey: ["x"], queryFn: failWith("UNAUTHORIZED", 401), retry: false })
            .catch(() => {});

        expect(invalidate).toHaveBeenCalledWith(
            { queryKey: SESSION_QUERY_KEY_PREFIX },
            { cancelRefetch: false },
        );
    });

    it("rechecks the session when a mutation comes back UNAUTHORIZED", async () => {
        const { queryClient, invalidate } = seededClient();

        await queryClient
            .getMutationCache()
            .build(queryClient, { mutationFn: failWith("UNAUTHORIZED", 401) })
            .execute(undefined)
            .catch(() => {});

        expect(invalidate).toHaveBeenCalledTimes(1);
    });

    it("leaves the session alone for other errors", async () => {
        const { queryClient, invalidate } = seededClient();

        await queryClient
            .fetchQuery({ queryKey: ["y"], queryFn: failWith("FORBIDDEN", 403), retry: false })
            .catch(() => {});

        expect(invalidate).not.toHaveBeenCalled();
    });
});
