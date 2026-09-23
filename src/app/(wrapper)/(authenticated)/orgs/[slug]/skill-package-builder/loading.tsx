/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-package-builder
 */

import { PageLoadingSpinner } from "@/components/ui/loading";

/**
 * Suspense boundary for navigations within the skill package builder module.
 * `skill-package-builder/layout.tsx` does no blocking data fetch of its own (a synchronous
 * `useOrganization()` check), so this catches every page-to-page navigation beneath it instead
 * of leaving the previous page inert with no feedback while the next one's data resolves. See
 * issue #212.
 */
export default function SkillPackageBuilder_LoadingPage() {
    return <PageLoadingSpinner />;
}
