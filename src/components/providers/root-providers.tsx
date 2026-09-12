/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { installDevTools } from "@/client/dev-tools";
import { useMutationEffector } from "@/trpc/mutation-effector";
import { getQueryClient } from "@/trpc/client";

/**
 * Root-level providers — mounted in `app/layout.tsx`, above every route group. Only what public
 * and `/auth/*` pages (outside the authenticated app shell) genuinely depend on belongs here:
 * `ThemeProvider` (its anti-flash inline script has to wrap `<html>`), `QueryClientProvider` (the
 * `/auth/*` pages use tRPC-client hooks), and `useMutationEffector` (patches that same
 * `QueryClient`'s mutation cache, so it stays physically paired with it).
 */
export function RootProviders({ children }: Readonly<{ children: ReactNode }>) {
    const queryClient = getQueryClient();
    useMutationEffector(queryClient);

    useEffect(() => {
        if (process.env.NODE_ENV !== "production") installDevTools();
    }, []);

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </ThemeProvider>
    );
}
