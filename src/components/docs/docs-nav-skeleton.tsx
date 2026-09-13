/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for the `/docs` sidebar while its flag-filtered nav streams in.
 *
 * The real nav depends on module flags, which read headers — so it can't be part of the static
 * shell and sits behind a `<Suspense>` in the docs layout. Mirrors `DocsSidebar`'s structure
 * (an overview link, then sections of pages) at plausible section sizes so the swap doesn't
 * shift the page. See docs/reviews/suspense-boundaries.md §3.
 */
export function DocsNav_Skeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading navigation">
            <Skeleton className="h-5 w-20" />
            {[4, 3, 3].map((pages, section) => (
                <div key={section} className="flex flex-col gap-1">
                    <Skeleton className="mb-1 h-3 w-24" />
                    {Array.from({ length: pages }, (_, page) => (
                        <Skeleton key={page} className="h-6 w-full" />
                    ))}
                </div>
            ))}
        </div>
    );
}
