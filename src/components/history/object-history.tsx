/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useId, type ReactNode } from "react";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { PersonLink } from "@/components/entity-links/person-link";
import { TeamLink } from "@/components/entity-links/team-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import {
    describeChange,
    FieldLabels,
    objectTypeLabel,
    type ChangeDescriptor,
} from "@/lib/diff-format";
import { LogObjectType } from "@/lib/schemas/log-entry";
import type {
    HistoryObjectType,
    ObjectHistoryEntry,
    ObjectHistoryRef,
} from "@/lib/schemas/object-history";
import { trpc } from "@/trpc/client";

export interface ObjectHistoryProps {
    objectType: HistoryObjectType;
    objectId: string;
    /** The page heading. Defaults to "History". */
    title?: ReactNode;
}

/**
 * An object's History page body: every audit-log entry about it (and related entries that
 * mention it), newest first, with a "Load more" button while older pages remain.
 *
 * The page's `page.tsx` prefetches the first page with `prefetchInfinite` and the same input
 * (no `limit`), so the keys match and this doesn't suspend on a cold fetch.
 */
export function ObjectHistory({ objectType, objectId, title = "History" }: ObjectHistoryProps) {
    const organization = useOrganization();
    const titleId = useId();

    const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
        trpc.history.listObjectHistory.infiniteQueryOptions(
            { organizationId: organization.id, objectType, objectId },
            {
                getNextPageParam: (page) => page.nextCursor ?? undefined,
                // No `staleTime` override: Suspense would clamp one below 1s anyway. Freshness
                // comes from the page's RSC `prefetchInfinite`, which reruns on each navigation,
                // and hydration overwrites the cache with its newer data.
            },
        ),
    );

    const entries = data.pages.flatMap((page) => page.entries);

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title id={titleId}>{title}</Saratoga.Title>
            </Saratoga.Header>

            {entries.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                    No history recorded yet.
                </p>
            ) : (
                <ol
                    aria-labelledby={titleId}
                    className="divide-y divide-border rounded-lg border border-border"
                >
                    {entries.map((entry) => (
                        <ObjectHistoryEntryItem key={entry.id} entry={entry} />
                    ))}
                </ol>
            )}

            {hasNextPage && (
                <div className="flex justify-center pt-2">
                    <Button
                        variant="outline"
                        aria-busy={isFetchingNextPage}
                        onClick={() => {
                            if (!isFetchingNextPage) void fetchNextPage();
                        }}
                    >
                        {isFetchingNextPage ? "Loading…" : "Load more"}
                    </Button>
                </div>
            )}
        </Saratoga.Root>
    );
}

function ObjectHistoryEntryItem({ entry }: { entry: ObjectHistoryEntry }) {
    const preferences = usePreferences();

    const entryType = LogObjectType.schema.safeParse(entry.objectType);
    const labels = entryType.success ? FieldLabels[entryType.data] : undefined;

    return (
        <li className="space-y-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge variant={actionBadgeVariant(entry.action)}>{entry.action}</Badge>
                {entry.relation === "related" && (
                    <Badge variant="outline">related: {objectTypeLabel(entry.objectType)}</Badge>
                )}
                <span className="text-sm font-medium">{actorText(entry)}</span>
                <span className="ml-auto text-sm">
                    <time dateTime={entry.timestamp.toISOString()}>
                        {preferences.formatDateTime(entry.timestamp)}
                    </time>{" "}
                    <span className="text-muted-foreground">
                        ({preferences.formatRelativeDateTime(entry.timestamp)})
                    </span>
                </span>
            </div>

            {entry.refs.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {entry.refs.map((ref, index) => (
                        <HistoryRef key={index} historyRef={ref} />
                    ))}
                </div>
            )}

            {entry.description && <p className="text-sm">{entry.description}</p>}

            {entry.changes.length > 0 && (
                <ul className="space-y-0.5 text-sm">
                    {entry.changes.map((change, index) => (
                        <ChangeLine
                            key={index}
                            change={describeChange(change, {
                                labels,
                                prefs: preferences.display,
                            })}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}

function HistoryRef({ historyRef }: { historyRef: ObjectHistoryRef }) {
    const typeLabel = objectTypeLabel(historyRef.objectType);

    // Narrowed with `in`, not on `objectType`: the fallback member's branded `string` is still
    // comparable to "Person"/"Team", so an `objectType` check doesn't discriminate the union.
    // A null person/team was purged or isn't viewable by the caller.
    const unavailable = <span className="text-muted-foreground">(unavailable)</span>;
    let target: ReactNode = null;
    if ("person" in historyRef) {
        target = historyRef.person ? <PersonLink person={historyRef.person} /> : unavailable;
    } else if ("team" in historyRef) {
        target = historyRef.team ? <TeamLink team={historyRef.team} /> : unavailable;
    }

    return (
        <span className="inline-flex items-center gap-1">
            <span className="text-muted-foreground">{typeLabel}</span>
            {target}
        </span>
    );
}

function ChangeLine({ change }: { change: ChangeDescriptor }) {
    const field = <span className="text-muted-foreground">{change.field}</span>;
    const prev = <span className="line-through decoration-muted-foreground">{change.prev}</span>;
    const curr = <span>{change.curr}</span>;

    let body: ReactNode;
    switch (change.kind) {
        case "set":
            body = <>{curr}</>;
            break;
        case "cleared":
            body = (
                <>
                    {prev} <span className="text-muted-foreground">(cleared)</span>
                </>
            );
            break;
        case "changed":
            body = (
                <>
                    {prev} <span className="text-muted-foreground">→</span> {curr}
                </>
            );
            break;
        case "added":
            body = (
                <>
                    <span className="text-muted-foreground">added</span> {curr}
                </>
            );
            break;
        case "removed":
            body = (
                <>
                    <span className="text-muted-foreground">removed</span> {prev}
                </>
            );
            break;
        case "masked":
            body = <span className="text-muted-foreground">changed (hidden)</span>;
            break;
        case "reordered":
            body = <span className="text-muted-foreground">reordered</span>;
            break;
    }

    return (
        <li>
            {field}: {body}
        </li>
    );
}

/** Who did it, by name. An actor-less batch entry reads as its operation ("D4H team sync"). */
function actorText(entry: ObjectHistoryEntry): string {
    const actor = entry.actorName ?? entry.operationLabel ?? "Unknown";
    const withImpersonator = entry.impersonatorName
        ? `${entry.impersonatorName} as ${actor}`
        : actor;

    return entry.actorName && entry.operationLabel
        ? `${withImpersonator} · ${entry.operationLabel}`
        : withImpersonator;
}

function actionBadgeVariant(action: string): "default" | "secondary" | "destructive" {
    switch (action) {
        case "Create":
            return "default";
        case "Delete":
        case "Purge":
        case "Revoke":
        case "Ban":
            return "destructive";
        default:
            return "secondary";
    }
}
