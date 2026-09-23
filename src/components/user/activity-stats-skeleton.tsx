/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for `ActivityStats_Card` while it streams in behind its own `<Suspense>`
 * boundary — see `user/page.tsx`. Keeps the boundary local to the activity card so a slow
 * activity query doesn't hold up the rest of the dashboard.
 */
export function ActivityStats_Skeleton() {
    return (
        <Card aria-busy="true" aria-label="Loading activity">
            <CardHeader>
                <Skeleton className="h-6 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-4">
                {Array.from({ length: 2 }, (_, i) => (
                    <div key={i} className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <div className="flex flex-wrap gap-2">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-5 w-28" />
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
