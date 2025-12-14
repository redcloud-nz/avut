/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { getQueryClient } from "@/trpc/client";
import { S2_SidebarProvider } from "@/components/ui/s2-sidebar";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
    const queryClient = getQueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <S2_SidebarProvider>{children}</S2_SidebarProvider>
        </QueryClientProvider>
    );
}
