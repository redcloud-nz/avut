/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]
 */

import { PageLoadingSpinner } from "@/components/ui/loading";

/**
 * Suspense boundary for navigations *into* this team from elsewhere, and for any nested layout
 * or page below this folder that suspends and has no closer boundary of its own. Like
 * `orgs/[slug]/loading.tsx`, it doesn't cover this folder's own `layout.tsx` (its blocking
 * `requireTeam` call): on a first/hard load that's covered by `(wrapper)/loading.tsx`.
 */
export default function Team_LoadingPage() {
    return <PageLoadingSpinner />;
}
