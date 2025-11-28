/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ReactNode, useEffect } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { init, printConsoleMessage } from "@/cli/init";

import { S2_SidebarProvider } from "@/components/ui/s2-sidebar";
import { Toaster } from "@/components/ui/toaster";

import { getQueryClient } from "@/trpc/client";

export type FrontendProviderProps = Readonly<{
    children: ReactNode;
}>;

export function AppFrontendProvider({ children }: FrontendProviderProps) {
    const queryClient = getQueryClient();

    useEffect(() => {
        printConsoleMessage();

        Object.assign(window, { init });
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <S2_SidebarProvider>{children}</S2_SidebarProvider>
            <Toaster />
        </QueryClientProvider>
    );
}
