/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]
 */

import { PageLoadingSpinner } from "@/components/ui/loading";

/**
 * Suspense boundary for navigations *into* this organization from elsewhere: cross-org
 * navigation, or entering `playground/`, whose layout still awaits a (lightweight) feature
 * flag lookup that its own `loading.tsx` can't cover (a `loading.tsx` doesn't wrap the
 * `layout.tsx` in its own folder). This also doesn't cover `orgs/[slug]/layout.tsx`'s own
 * blocking `requireOrganization` call — that's covered on first/hard load by
 * `(wrapper)/loading.tsx` above `(authenticated)/layout.tsx`, and cross-org navigation is rare
 * enough not to chase further for now. What this *does* catch: any nested layout or page below
 * this folder that suspends and has no closer boundary of its own. See issue #212.
 */
export default function Organization_LoadingPage() {
    return <PageLoadingSpinner />;
}
