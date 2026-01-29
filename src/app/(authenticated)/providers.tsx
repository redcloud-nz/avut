/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { getQueryClient } from "@/trpc/client";
import { SidebarProvider } from "@/components/ui/sidebar";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
    const queryClient = getQueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <SidebarProvider>{children}</SidebarProvider>
        </QueryClientProvider>
    );
}
