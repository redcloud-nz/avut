/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /(wrapper)
 */

import { cookies } from "next/headers";
import { type ReactNode } from "react";

import { AppProviders } from "@/components/providers/app-providers";
import { ImpersonationBanner } from "@/components/system-admin/impersonation-banner";
import { SIDEBAR_COOKIE_NAME } from "@/lib/constants";

export default async function AppLayout(props: { children: ReactNode }) {
    // `SidebarProvider` persists the collapsed/expanded choice to this cookie but never reads it
    // back, so the server has to seed it. Absent cookie = expanded, matching a first-time visitor.
    const sidebarOpen = (await cookies()).get(SIDEBAR_COOKIE_NAME)?.value !== "false";

    return (
        <AppProviders defaultSidebarOpen={sidebarOpen}>
            <ImpersonationBanner />
            {props.children}
        </AppProviders>
    );
}
