/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/playground
 */

import { PageLoadingSpinner } from "@/components/ui/loading";

/**
 * Suspense boundary for navigations *within* the playground module. Note that
 * `playground/layout.tsx` itself does a blocking `await requireOrganization(slug)`, and a
 * `loading.tsx` does not wrap the `layout.tsx` in its own folder — only `page.tsx` and nested
 * layouts below it — so this covers page-to-page navigation once inside the playground, but
 * not the layout's own blocking work when navigating in fresh from another module. Closing
 * that gap needs a boundary one level up, at `orgs/[slug]/`. See issue #212.
 */
export default function Playground_LoadingPage() {
    return <PageLoadingSpinner />;
}
