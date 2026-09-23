/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /(wrapper)
 */

import { type ReactNode } from "react";

import { AppProviders } from "@/components/providers/app-providers";
import { ImpersonationBanner } from "@/components/system-admin/impersonation-banner";

export default function AppLayout(props: { children: ReactNode }) {
    return (
        <AppProviders>
            <ImpersonationBanner />
            {props.children}
        </AppProviders>
    );
}
