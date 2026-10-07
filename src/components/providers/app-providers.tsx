/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense, type ReactNode } from "react";

import { HotkeysProvider } from "@tanstack/react-hotkeys";

import { HelpSheet } from "@/components/docs/help-sheet";
import { HotkeyHelp } from "@/components/hotkey-help";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * App-shell providers — mounted once in `(wrapper)/layout.tsx`, above both the authenticated and
 * any future public-scope trees. Everything here has no consumers outside that shell: nuqs-driven
 * dialogs/params, hotkeys, tooltips (used by `HelpButton`), the sidebar context, and the `?help=`
 * sheet itself.
 */
export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <NuqsAdapter>
            <HotkeysProvider>
                <TooltipProvider>
                    <SidebarProvider>{children}</SidebarProvider>
                </TooltipProvider>
                <HotkeyHelp />
                <Suspense fallback={null}>
                    <HelpSheet />
                </Suspense>
            </HotkeysProvider>
        </NuqsAdapter>
    );
}
