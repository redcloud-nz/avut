/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { AuthUIProvider } from "@daveyplate/better-auth-ui";

import { authClient } from "@/lib/auth-client";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
    const router = useRouter();

    return (
        <AuthUIProvider
            authClient={authClient}
            navigate={router.push}
            replace={router.replace}
            onSessionChange={() => {
                router.refresh();
            }}
            Link={Link}
        >
            {children}
        </AuthUIProvider>
    );
}
