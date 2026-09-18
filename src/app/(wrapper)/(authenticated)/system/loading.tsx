/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system
 */

import { PageLoadingSpinner } from "@/components/ui/loading";

/**
 * Suspense boundary for navigations *into* the system scope from another one. It sits above
 * `system/admin/layout.tsx`, whose `requireSystemAdmin()` call blocks and which `admin/loading.tsx`
 * therefore can't cover. See issue #212.
 */
export default function System_LoadingPage() {
    return <PageLoadingSpinner />;
}
