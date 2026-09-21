/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system/admin
 */

import { PageLoadingSpinner } from "@/components/ui/loading";

/**
 * Suspense boundary for navigations within the system-admin module — organizations list to
 * organization detail, users list to user detail, and so on — instead of leaving the previous
 * page inert with no feedback while the next one's data resolves. Entering the module from
 * another scope is covered one level up, in `system/loading.tsx`, since a `loading.tsx` doesn't
 * wrap the `layout.tsx` in its own folder. See issue #212.
 */
export default function SystemAdmin_LoadingPage() {
    return <PageLoadingSpinner />;
}
