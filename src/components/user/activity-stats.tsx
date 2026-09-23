/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useMemo } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";

/**
 * Prototype dashboard card — per-organization counts of log entries by object type and
 * action over the last 24 hours. Counts only, no entry details, so it carries no
 * permission concerns beyond membership itself (see `users.getActivityStats`).
 *
 * Reads via `useSuspenseQuery` behind its own `<Suspense>` boundary (see
 * `ActivityStats_Skeleton` below and its usage in `user/page.tsx`) rather than the
 * page's shared one, so a slow activity query doesn't hold up the rest of the dashboard.
 */
export function ActivityStats_Card() {
    const [{ data: memberships }, { data: stats }] = useSuspenseQueries({
        queries: [
            trpc.users.listMemberships.queryOptions(),
            trpc.users.getActivityStats.queryOptions(),
        ],
    });

    const groups = useMemo(
        () =>
            memberships
                .map((membership) => ({
                    organization: membership.organization,
                    stats: stats.filter((row) => row.organizationId === membership.organization.id),
                }))
                .filter((group) => group.stats.length > 0),
        [memberships, stats],
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Activity (last 24h)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No activity in the last 24 hours.
                    </p>
                ) : (
                    groups.map(({ organization, stats }) => (
                        <div key={organization.id}>
                            <div className="font-medium">{organization.name}</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                                {stats.map((row) => (
                                    <Badge
                                        key={`${row.objectType}-${row.action}`}
                                        variant="secondary"
                                    >
                                        {row.action} {row.objectType} ({row.count})
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Placeholder for `ActivityStats_Card` while it streams in behind its own `<Suspense>`
 * boundary — see `user/page.tsx`.
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
