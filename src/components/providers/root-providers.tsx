/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { ClientProvider } from "@/components/providers/client-provider";

/**
 * Root-level providers — mounted in `app/layout.tsx`, above every route group. Only what public
 * and `/auth/*` pages (outside the authenticated app shell) genuinely depend on belongs here:
 * `ThemeProvider` (its anti-flash inline script has to wrap `<html>`), `ClientProvider` (the
 * `/auth/*` pages use tRPC-client hooks; it also wires the mutation effector, which patches that
 * same `QueryClient`'s mutation cache), and `Toaster` (`/auth/*` pages toast too).
 *
 * A server component itself — the client-only logic lives in `ClientProvider`, kept as small as
 * possible so this composition doesn't need to be client.
 */
export function RootProviders({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <ClientProvider>{children}</ClientProvider>
            <Toaster richColors />
        </ThemeProvider>
    );
}
