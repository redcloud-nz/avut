/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for an auth card while the component that reads `searchParams` streams in.
 *
 * The `/auth/*` pages read `searchParams` (a pre-filled email, a `redirectTo`) to build their
 * card. Under Cache Components that read can't be part of the static shell, so it sits behind a
 * `<Suspense>` and this stands in for it — which lets the surrounding `Argus` shell and logo
 * prerender instead of the whole route blocking. See docs/reviews/suspense-boundaries.md §3.
 *
 * `fields` matches the number of inputs in the real card so the swap doesn't jump the layout.
 */
export function AuthCard_Skeleton({ fields = 2 }: { fields?: number }) {
    return (
        <Card aria-busy="true" aria-label="Loading">
            <CardHeader className="gap-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                {Array.from({ length: fields }, (_, i) => (
                    <div key={i} className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                ))}
                <Skeleton className="h-9 w-full" />
            </CardContent>
        </Card>
    );
}
