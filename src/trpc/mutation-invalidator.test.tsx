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
