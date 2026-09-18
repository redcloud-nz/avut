/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /
 */

import { PageLoadingSpinner } from "@/components/ui/loading";

/**
 * Load-bearing — do not delete without reading this.
 *
 * This is the Suspense boundary that sits above `(authenticated)/layout.tsx`, and therefore
 * above the `requireSession()` call at the top of it. That satisfies *build-time* prerender
 * validation for every authenticated route's static shell — the blocking session read happens
 * inside this boundary rather than outside one. It does not cover *runtime* instant-navigation
 * validation for client-side navigations between authenticated routes; that's a separate check
 * `(authenticated)/layout.tsx` suppresses directly with `export const instant = false`, since
 * session data is per-request and security-sensitive rather than a `"use cache"` candidate.
 *
 * It lives in `(wrapper)` rather than at `src/app/` so its reach stops short of `/` — a root
 * `loading.tsx` also wrapped the landing page, which silently absorbed a render error there
 * for as long as it existed. Route groups are transparent to routing, so `(wrapper)` costs
 * nothing in the URL while bounding the boundary.
 *
 * Removing this file fails the build: every `/orgs/[slug]/…` route then reports uncached data
 * during prerendering. See docs/reviews/suspense-boundaries.md §1 and §3.
 */
export default function RootLoadingPage() {
    return <PageLoadingSpinner />;
}
