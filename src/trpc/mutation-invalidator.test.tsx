/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";

import { MutationInvalidator } from "./mutation-invalidator";

function makeClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
}

describe("MutationInvalidator", () => {
    it("invalidates the queries declared in meta.invalidates after a mutation succeeds", async () => {
        const queryClient = makeClient();
        const queryFn = vi.fn().mockResolvedValue("value");
        queryClient.setQueryData(["thing", "1"], "stale");

        function Harness() {
            useQuery({ queryKey: ["thing", "1"], queryFn, staleTime: Infinity });
            const mutation = useMutation({
                mutationFn: () => Promise.resolve({ id: "1" }),
                meta: {
                    invalidates: (_vars: unknown, data: { id: string }) => [
                        { queryKey: ["thing", data.id] },
                    ],
                },
            });
            return <button onClick={() => mutation.mutate()}>mutate</button>;
        }

        render(
            <QueryClientProvider client={queryClient}>
                <MutationInvalidator />
                <Harness />
            </QueryClientProvider>,
        );

        expect(queryFn).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button"));

        await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
    });

    it("does nothing for mutations without meta.invalidates", async () => {
        const queryClient = makeClient();
        const queryFn = vi.fn().mockResolvedValue("value");
        queryClient.setQueryData(["other"], "stale");

        function Harness() {
            useQuery({ queryKey: ["other"], queryFn, staleTime: Infinity });
            const mutation = useMutation({ mutationFn: () => Promise.resolve() });
            return <button onClick={() => mutation.mutate()}>mutate</button>;
        }

        render(
            <QueryClientProvider client={queryClient}>
                <MutationInvalidator />
                <Harness />
            </QueryClientProvider>,
        );

        fireEvent.click(screen.getByRole("button"));

        await waitFor(() =>
            expect(queryClient.getMutationCache().getAll()[0]?.state.status).toBe("success"),
        );

        expect(queryFn).not.toHaveBeenCalled();
    });

    it("writes the mutation response directly into the cache entries declared in meta.writes", async () => {
        const queryClient = makeClient();
        queryClient.setQueryData(["thing", "1"], "stale");

        function Harness() {
            const { data } = useQuery({
                queryKey: ["thing", "1"],
                queryFn: () => Promise.resolve("stale"),
                staleTime: Infinity,
            });
            const mutation = useMutation({
                mutationFn: () => Promise.resolve({ id: "1", value: "fresh" }),
                meta: {
                    writes: (_vars: unknown, data: { id: string; value: string }) => [
                        { queryKey: ["thing", data.id], data: data.value },
                    ],
                },
            });
            return (
                <>
                    <span data-testid="value">{data}</span>
                    <button onClick={() => mutation.mutate()}>mutate</button>
                </>
            );
        }

        render(
            <QueryClientProvider client={queryClient}>
                <MutationInvalidator />
                <Harness />
            </QueryClientProvider>,
        );

        expect(screen.getByTestId("value").textContent).toBe("stale");

        fireEvent.click(screen.getByRole("button"));

        await waitFor(() => expect(screen.getByTestId("value").textContent).toBe("fresh"));
    });

    it("accepts an updater function in meta.writes to merge into the existing cache entry", async () => {
        const queryClient = makeClient();
        queryClient.setQueryData(["thing", "1"], { name: "Alice", role: "admin" });

        function Harness() {
            const { data } = useQuery<{ name: string; role: string }>({
                queryKey: ["thing", "1"],
                queryFn: () => Promise.resolve({ name: "Alice", role: "admin" }),
                staleTime: Infinity,
            });
            const mutation = useMutation({
                mutationFn: () => Promise.resolve({ id: "1", updated: { role: "owner" } }),
                meta: {
                    writes: (_vars: unknown, data: { id: string; updated: { role: string } }) => [
                        {
                            queryKey: ["thing", data.id],
                            data: (old: { name: string; role: string } | undefined) =>
                                old ? { ...old, ...data.updated } : old,
                        },
                    ],
                },
            });
            return (
                <>
                    <span data-testid="name">{data?.name}</span>
                    <span data-testid="role">{data?.role}</span>
                    <button onClick={() => mutation.mutate()}>mutate</button>
                </>
            );
        }

        render(
            <QueryClientProvider client={queryClient}>
                <MutationInvalidator />
                <Harness />
            </QueryClientProvider>,
        );

        fireEvent.click(screen.getByRole("button"));

        // The name survives (carried over from the existing cache entry) while only the field
        // the mutation actually returned changes.
        await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("owner"));
        expect(screen.getByTestId("name").textContent).toBe("Alice");
    });

    it("applies meta.writes before triggering the meta.invalidates refetch", async () => {
        const queryClient = makeClient();
        let resolveNetwork!: (value: string) => void;
        const queryFn = vi.fn(() => new Promise<string>((resolve) => (resolveNetwork = resolve)));
        queryClient.setQueryData(["thing", "1"], "stale");

        function Harness() {
            useQuery({ queryKey: ["thing", "1"], queryFn, staleTime: Infinity });
            const mutation = useMutation({
                mutationFn: () => Promise.resolve({ id: "1", value: "from-write" }),
                meta: {
                    writes: (_vars: unknown, data: { id: string; value: string }) => [
                        { queryKey: ["thing", data.id], data: data.value },
                    ],
                    invalidates: (_vars: unknown, data: { id: string }) => [
                        { queryKey: ["thing", data.id] },
                    ],
                },
            });
            return <button onClick={() => mutation.mutate()}>mutate</button>;
        }

        render(
            <QueryClientProvider client={queryClient}>
                <MutationInvalidator />
                <Harness />
            </QueryClientProvider>,
        );

        fireEvent.click(screen.getByRole("button"));

        // By the time invalidation has kicked off the (still-pending) refetch, the write has
        // already landed in the cache.
        await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
        expect(queryClient.getQueryData(["thing", "1"])).toBe("from-write");

        resolveNetwork("from-network");
        await waitFor(() => expect(queryClient.getQueryData(["thing", "1"])).toBe("from-network"));
    });

    it("chains a previously-installed mutationCache.onSuccess handler instead of replacing it", async () => {
        const queryClient = makeClient();
        const previousOnSuccess = vi.fn();
        queryClient.getMutationCache().config.onSuccess = previousOnSuccess;

        function Harness() {
            const mutation = useMutation({ mutationFn: () => Promise.resolve("done") });
            return <button onClick={() => mutation.mutate()}>mutate</button>;
        }

        render(
            <QueryClientProvider client={queryClient}>
                <MutationInvalidator />
                <Harness />
            </QueryClientProvider>,
        );

        fireEvent.click(screen.getByRole("button"));

        await waitFor(() => expect(previousOnSuccess).toHaveBeenCalledTimes(1));
    });
});
