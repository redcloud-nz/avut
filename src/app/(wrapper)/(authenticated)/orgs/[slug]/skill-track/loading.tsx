/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track
 */

import { PageLoadingSpinner } from "@/components/ui/loading";

/**
 * Suspense boundary for navigations within the skill track module. `skill-track/layout.tsx`
 * does no blocking data fetch of its own (a synchronous `useOrganization()` check), so this
 * catches every page-to-page navigation beneath it instead of leaving the previous page inert
 * with no feedback while the next one's data resolves. See issue #212.
 */
export default function SkillTrack_LoadingPage() {
    return <PageLoadingSpinner />;
}
