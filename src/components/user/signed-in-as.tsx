/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";

export function SignedInAs_Card() {
    const { data: session } = useSuspenseQuery(trpc.user.getSession.queryOptions());

    if (!session) return null;

    return (
        <Card>
            <CardContent className="flex gap-2">
                <div className="font-medium pr-2">Signed in as</div>
                <div>{session.user.name}</div>
                <div className="text-muted-foreground">{session.user.email}</div>
            </CardContent>
        </Card>
    );
}

/**
 * Placeholder for `SignedInAs_Card` while it streams in behind its own `<Suspense>`
 * boundary — see `user/page.tsx`.
 */
export function SignedInAs_Skeleton() {
    return (
        <Card aria-busy="true" aria-label="Loading signed-in user">
            <CardContent className="flex gap-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-48" />
            </CardContent>
        </Card>
    );
}
