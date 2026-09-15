/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/playground
 */

import { PageLoadingSpinner } from "@/components/ui/loading";

/**
 * Suspense boundary for navigations within the playground module. `playground/layout.tsx`
 * still awaits `playgroundFlag()` (a lightweight deployment-flag lookup, not a DB round trip;
 * see the layout for why it dropped `requireOrganization`), and a `loading.tsx` does not wrap
 * the `layout.tsx` in its own folder, so that one check still isn't covered on first entry —
 * but every page-to-page navigation once inside the playground is. See issue #212.
 */
export default function Playground_LoadingPage() {
    return <PageLoadingSpinner />;
}
