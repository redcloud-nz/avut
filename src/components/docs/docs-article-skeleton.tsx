/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for a docs article while the doc is resolved.
 *
 * Resolving a doc consults module flags, which read headers, so it can't be part of the static
 * shell. Note this boundary has to live *inside* `page.tsx` rather than in a `loading.tsx`: a
 * `loading.tsx` nests inside the layout, above its own segment's validation boundary, which
 * satisfies the prerender check but not instant-navigation validation.
 * See docs/reviews/suspense-boundaries.md §3.
 */
export function DocsArticle_Skeleton() {
    return (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="mt-4 h-7 w-1/3" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-10/12" />
        </div>
    );
}
