/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { SidebarProvider } from "@/components/ui/sidebar";
import { installDevTools } from "@/client/dev-tools";
import { MutationInvalidator } from "@/trpc/mutation-invalidator";
import { getQueryClient } from "@/trpc/client";
import { TooltipProvider } from "./ui/tooltip";

export function CommonProviders({ children }: Readonly<{ children: ReactNode }>) {
    const queryClient = getQueryClient();

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
            <QueryClientProvider client={queryClient}>
                <MutationInvalidator />
                <TooltipProvider>
                    <SidebarProvider>{children}</SidebarProvider>
                </TooltipProvider>
            </QueryClientProvider>
        </ThemeProvider>
    );
}
