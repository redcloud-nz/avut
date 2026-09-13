/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { installDevTools } from "@/client/dev-tools";
import { getQueryClient } from "@/trpc/client";
import { useMutationEffector } from "@/trpc/mutation-effector";

/**
 * The client-only slice of the root providers — getting/creating the `QueryClient`, wiring the
 * mutation effector to it, and installing dev tools. Isolated to this leaf so `RootProviders`
 * itself can stay a server component; everything here needs client hooks and can't.
 */
export function ClientProvider({ children }: Readonly<{ children: ReactNode }>) {
    const queryClient = getQueryClient();

    useMutationEffector(queryClient);

    useEffect(() => {
        if (process.env.NODE_ENV !== "production") installDevTools();
    }, []);

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
