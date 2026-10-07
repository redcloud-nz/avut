/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useMemo, type ReactNode } from "react";

import { useSuspenseInfiniteQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { PersonLink } from "@/components/entity-links/person-link";
import { TeamLink } from "@/components/entity-links/team-link";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import type { DisplayPreferences } from "@/lib/datetime";
import type { DiffValue } from "@/lib/diff";
import {
    actionPastTenseLabel,
    describeChanges,
    FieldLabels,
    formatDiffValue,
    lowerFirst,
    objectTypeLabel,
    relatedActionPhrase,
    summariseChanges,
    type ChangeDescriptor,
} from "@/lib/diff-format";
import { LogObjectType } from "@/lib/schemas/log-entry";
import {
    idFieldTarget,
    type HistoryObjectType,
    type IdFieldTarget,
    type ObjectHistoryEntry,
    type ObjectHistoryPage,
    type ObjectHistoryRef,
    type OwnHistoryObjectType,
} from "@/lib/schemas/object-history";
import { trpc } from "@/trpc/client";

export type ObjectHistoryProps = {
    objectId: string;
    /** The page heading. Defaults to "History". */
    title?: ReactNode;
} & (
    | {
          /** An organization's object, read with `history.listObjectHistory`. The default. */
          scope?: "organization";
          objectType: HistoryObjectType;
      }
    | {
          /** One of the caller's own records, read with `history.listOwnObjectHistory`. */
          scope: "user";
          objectType: OwnHistoryObjectType;
      }
);

/**
 * An object's History page body: every audit-log entry about it (and related entries that
 * mention it), newest first, with a "Load more" button while older pages remain.
 *
 * `scope` picks the query: an organization's log (the default, inside an organization) or the
 * caller's own (`scope="user"`, which needs no organization).
 *
 * The page's `page.tsx` prefetches the first page with `prefetchInfinite` and the same input
 * (no `limit`), so the keys match and this doesn't suspend on a cold fetch.
 */
export function ObjectHistory(props: ObjectHistoryProps) {
    return props.scope === "user" ? (
        <OwnObjectHistory {...props} />
    ) : (
        <OrgObjectHistory {...props} />
    );
}

// No `staleTime` override on either query: Suspense would clamp one below 1s anyway. Freshness
// comes from the page's RSC `prefetchInfinite`, which reruns on each navigation, and hydration
// overwrites the cache with its newer data.

function OrgObjectHistory({
    objectType,
    objectId,
    title,
}: {
    objectType: HistoryObjectType;
    objectId: string;
    title?: ReactNode;
}) {
    const organization = useOrganization();

    const query = useSuspenseInfiniteQuery(
        trpc.history.listObjectHistory.infiniteQueryOptions(
            { organizationId: organization.id, objectType, objectId },
            { getNextPageParam: (page) => page.nextCursor ?? undefined },
        ),
    );

    return <ObjectHistoryList query={query} pageType={objectType} title={title} />;
}

function OwnObjectHistory({
    objectType,
    objectId,
    title,
}: {
    objectType: OwnHistoryObjectType;
    objectId: string;
    title?: ReactNode;
}) {
    const query = useSuspenseInfiniteQuery(
        trpc.history.listOwnObjectHistory.infiniteQueryOptions(
            { objectType, objectId },
            { getNextPageParam: (page) => page.nextCursor ?? undefined },
        ),
    );

    return <ObjectHistoryList query={query} pageType={objectType} title={title} />;
}

interface HistoryQuery {
    data: { pages: ObjectHistoryPage[] };
    hasNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
    isFetchingNextPage: boolean;
}

function ObjectHistoryList({
    query: { data, hasNextPage, fetchNextPage, isFetchingNextPage },
    pageType,
    title = "History",
}: {
    query: HistoryQuery;
    pageType: string;
    title?: ReactNode;
}) {
    const titleId = useId();

    const entries = data.pages.flatMap((page) => page.entries);
    // Each page resolves the ids on it; an id means the same record on every page, so merge them.
    const names = useMemo<IdFieldNames>(
        () => ({
            Person: Object.assign({}, ...data.pages.map((page) => page.names.Person)),
            Skill: Object.assign({}, ...data.pages.map((page) => page.names.Skill)),
        }),
        [data.pages],
    );

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
                    className="divide-y divide-border border-y border-border"
                >
                    {entries.map((entry) => (
                        <ObjectHistoryEntryItem
                            key={entry.id}
                            entry={entry}
                            pageType={pageType}
                            names={names}
                        />
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

function ObjectHistoryEntryItem({
    entry,
    pageType,
    names,
}: {
    entry: ObjectHistoryEntry;
    pageType: string;
    names: IdFieldNames;
}) {
    const preferences = usePreferences();

    const entryType = LogObjectType.schema.safeParse(entry.objectType);
    const labels = entryType.success ? FieldLabels[entryType.data] : undefined;

    // A related entry with a phrase ("Added to team") names its refs after it, as the sentence's
    // object ("Added to team Erehwon Logistics — …"); the linked refs are in the details. One
    // without a phrase names its own type instead ("Updated organisation membership — …").
    const phrase =
        entry.relation === "related"
            ? relatedActionPhrase(entry.objectType, pageType, entry.action)
            : undefined;
    // An update to the object itself that only moved values in one list says so ("Added 26
    // skills") instead of the bare "Updated".
    const changeSummary =
        entry.relation === "primary" && entry.action === "Update"
            ? summariseChanges(entry.changes, labels)
            : undefined;
    const verb =
        phrase ??
        changeSummary ??
        (entry.relation === "related"
            ? `${actionPastTenseLabel(entry.action)} ${lowerFirst(objectTypeLabel(entry.objectType))}`
            : actionPastTenseLabel(entry.action));
    // A ref with no name to show (purged, not viewable) is left out of the sentence rather than
    // standing in as its type ("Added to team team"); the details still list it as unavailable.
    const inlineNames = phrase ? entry.refs.flatMap((ref) => refName(ref) ?? []) : [];

    // Plain text, read as a sentence: "Added to team Erehwon Logistics — Demo Owner", with only
    // the relative time after it. In a narrow list (the `<li>` is the container) it drops to the
    // bare action, "Added to team" / "Updated membership"; the body repeats the ref and actor, so
    // nothing is lost. Nothing in it is a link (the refs are linked in the body), so the whole
    // row can be the collapse button. The relative time sits at the row's end, and wraps under
    // the title when it doesn't fit.
    const summary = (
        // A `<span>`, not a `<div>`: it sits inside the trigger `<button>`, which allows only
        // phrasing content.
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="@2xl:hidden">{verb.replace(/ of$/, "")}</span>
            <span className="hidden @2xl:inline">
                {[verb, ...inlineNames].join(" ")} — {actorText(entry)}
            </span>
            <time
                dateTime={entry.timestamp.toISOString()}
                className="ml-auto whitespace-nowrap text-muted-foreground"
            >
                {preferences.formatRelativeDateTime(entry.timestamp)}
            </time>
        </span>
    );

    // Every entry has a body (its full timestamp, at least), so every row expands.
    return (
        <li className="@container">
            <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-muted/50 sm:px-2">
                    {summary}
                    <ChevronDownIcon
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                        aria-hidden
                    />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 px-1 pb-3 sm:px-2">
                    <p className="text-sm">
                        <span className="text-muted-foreground">Timestamp</span>{" "}
                        <time dateTime={entry.timestamp.toISOString()}>
                            {preferences.formatDateTime(entry.timestamp)}
                        </time>
                    </p>

                    <p className="text-sm">
                        <span className="text-muted-foreground">By</span> {actorText(entry)}
                    </p>

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
                            {describeChanges(entry.changes, (change) => ({
                                labels,
                                prefs: preferences.display,
                                valueLabel: idValueLabel(
                                    idFieldTarget(entry.objectType, change.path),
                                    names,
                                    preferences.display,
                                ),
                            })).map((line, index) => (
                                <ChangeLine key={index} change={line} />
                            ))}
                        </ul>
                    )}
                </CollapsibleContent>
            </Collapsible>
        </li>
    );
}

type IdFieldNames = ObjectHistoryPage["names"];

/**
 * For a change in an `IdFields` field, a `valueLabel` that shows each id as its record's name, or
 * "(unavailable)" when the service couldn't resolve it (purged, or not this organization's). A
 * value that isn't an id-shaped string (a `null` prev) keeps the default formatting.
 */
function idValueLabel(
    target: IdFieldTarget | undefined,
    names: IdFieldNames,
    prefs: DisplayPreferences,
): ((value: DiffValue) => string) | undefined {
    if (!target) return undefined;
    const byId = names[target];
    return (value) =>
        typeof value === "string" && value !== ""
            ? ((Object.hasOwn(byId, value) ? byId[value] : undefined) ?? "(unavailable)")
            : formatDiffValue(value, prefs);
}

/**
 * A ref's name as plain text, for the summary sentence: the person's or team's name, or `null`
 * when it has none to show (purged, not viewable, or a type that isn't resolved).
 */
function refName(historyRef: ObjectHistoryRef): string | null {
    if ("person" in historyRef && historyRef.person) return historyRef.person.name;
    if ("team" in historyRef && historyRef.team) return historyRef.team.name;
    return null;
}

function HistoryRef({ historyRef }: { historyRef: ObjectHistoryRef }) {
    const typeLabel = objectTypeLabel(historyRef.objectType);

    // Narrowed with `in`, not on `objectType`: the fallback member's `objectType` is a plain
    // `string`, so an `objectType` check doesn't discriminate the union.
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
    // A grouped add/remove line says how many values it stands for.
    const count = change.count && <span className="text-muted-foreground"> ({change.count})</span>;

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
                    {count}
                </>
            );
            break;
        case "removed":
            body = (
                <>
                    <span className="text-muted-foreground">removed</span> {prev}
                    {count}
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
        ? `${withImpersonator} (${entry.operationLabel})`
        : withImpersonator;
}
