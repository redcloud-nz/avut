/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Path: /(wrapper)
 */

import { type ReactNode } from "react";

import { AppProviders } from "@/components/providers/app-providers";

// `ImpersonationBanner` is disabled (#347). Rendered here, above the authenticated layout,
// its `useSuspenseQuery(getSession)` ran during server rendering before the authenticated
// layout's session was hydrated, cached `null`, and made every session read below it render as
// signed out on the server: a hydration mismatch on every authenticated page.
export default function AppLayout(props: { children: ReactNode }) {
    return <AppProviders>{props.children}</AppProviders>;
}
