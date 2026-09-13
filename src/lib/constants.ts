/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export const TITLE_SEPARATOR = "•";

/**
 * Request header carrying the current path + query, injected by the proxy.
 *
 * Next.js exposes no stable request-path header during render, and `cookies().set()` is
 * not permitted there, so this is how server components learn where the user was trying
 * to go in order to build a `?redirectTo=` sign-in URL.
 */
export const CURRENT_PATH_HEADER = "x-avut-pathname";

/**
 * Cookie the sidebar persists its collapsed/expanded state to.
 *
 * Lives here rather than in `components/ui/sidebar.tsx` because the authenticated layout — a
 * server component — has to read it to seed `SidebarProvider`'s `defaultOpen`. A `"use client"`
 * module's exports become client references when imported from a server component, so the
 * literal would not survive the trip.
 */
export const SIDEBAR_COOKIE_NAME = "sidebar_state";
