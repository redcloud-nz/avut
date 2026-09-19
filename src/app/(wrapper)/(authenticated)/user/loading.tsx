/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user
 */

import { PageLoadingSpinner } from "@/components/ui/loading";

/**
 * Suspense boundary for navigations into and within the personal-account scope — the dashboard
 * and the `settings/` pages. There is no layout at this level, and each page does its own async
 * work (a session check plus prefetches), so without this the previous page sits inert until the
 * next one is ready. See issue #212.
 */
export default function User_LoadingPage() {
    return <PageLoadingSpinner />;
}
