/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { SidebarProvider } from "@/components/ui/sidebar";
import { getQueryClient } from "@/trpc/client";

export function CommonProviders({
    children,
}: Readonly<{ children: ReactNode }>) {
    const queryClient = getQueryClient();

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <QueryClientProvider client={queryClient}>
                <SidebarProvider>{children}</SidebarProvider>
            </QueryClientProvider>
        </ThemeProvider>
    );
}
