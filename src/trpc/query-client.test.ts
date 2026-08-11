/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { dehydrate } from "@tanstack/react-query";

import { authQueryKeys } from "@/lib/auth-query-keys";

import { makeQueryClient } from "./query-client";

describe("makeQueryClient dehydration", () => {
    // A pending-only predicate silently drops settled queries, which would make every
    // server-side `ensureQueryData` a no-op and send the client back to the network.
    it("dehydrates a settled query", async () => {
        const queryClient = makeQueryClient();

        await queryClient.ensureQueryData({
            queryKey: authQueryKeys.session,
            queryFn: async () => ({ user: { id: "abc" } }),
        });

        const keys = dehydrate(queryClient).queries.map((q) => q.queryKey);
        expect(keys).toContainEqual([...authQueryKeys.session]);
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
        const { retry } = queryClient.getQueryDefaults(authQueryKeys.session);

        expect(typeof retry).toBe("function");
        expect((retry as (n: number, e: unknown) => boolean)(0, { status: 401 })).toBe(false);
        expect((retry as (n: number, e: unknown) => boolean)(0, { status: 403 })).toBe(false);
    });

    it("retries transient failures, including network-level ones", () => {
        const queryClient = makeQueryClient();
        const retry = queryClient.getQueryDefaults(authQueryKeys.session).retry as (
            n: number,
            e: unknown,
        ) => boolean;

        expect(retry(0, { status: 503 })).toBe(true);
        expect(retry(0, { status: 429 })).toBe(true);
        expect(retry(0, new Error("network down"))).toBe(true);
    });

    it("gives up after three attempts", () => {
        const queryClient = makeQueryClient();
        const retry = queryClient.getQueryDefaults(authQueryKeys.session).retry as (
            n: number,
            e: unknown,
        ) => boolean;

        expect(retry(3, { status: 503 })).toBe(false);
    });

    it("honours Retry-After when the error carries one", () => {
        const queryClient = makeQueryClient();
        const retryDelay = queryClient.getQueryDefaults(authQueryKeys.session).retryDelay as (
            n: number,
            e: unknown,
        ) => number;

        expect(retryDelay(0, { retryAfterMs: 4200 })).toBe(4200);
        expect(retryDelay(1, {})).toBe(2000);
        expect(retryDelay(99, {})).toBe(30_000);
    });
});
