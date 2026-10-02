/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Read model over the compiled `updates` content collection (the "What's new"
 * entries). Pure data — safe to import from server components and route
 * handlers (no `server-only` deps).
 *
 * An entry is unseen by a user when its `publishedAt` is after their
 * `User.lastSeenUpdatesAt` cursor (null falls back to `User.createdAt`); ties
 * count as seen. See docs/plans/2026-09-30-whats-new-popup.md.
 */

import { allUpdates, type Update } from "content-collections";

import type { UpdateEntryData } from "@/lib/updates-shared";

export type { UpdateEntryData };
export { updatesHref } from "@/lib/updates-shared";

/** An entry's `publishedAt` as an instant (00:00 UTC on that date). */
function publishedAtDate(entry: Pick<Update, "publishedAt">): Date {
    return new Date(`${entry.publishedAt}T00:00:00Z`);
}

function newestFirst(a: Update, b: Update): number {
    // ISO dates sort lexically; slug ascending breaks same-day ties.
    return b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug);
}

function toEntryData(entry: Update): UpdateEntryData {
    return {
        slug: entry.slug,
        title: entry.title,
        publishedAt: entry.publishedAt,
        description: entry.description,
        version: entry.version,
        mdx: entry.mdx,
    };
}

function sortedUpdates(): Update[] {
    return [...allUpdates].sort(newestFirst);
}

/** Every entry, newest first. */
export function getAllUpdates(): UpdateEntryData[] {
    return sortedUpdates().map(toEntryData);
}

/** Entries published strictly after `cursor` (an entry dated at the cursor counts as seen), newest first. */
export function getUpdatesAfter(cursor: Date): UpdateEntryData[] {
    return sortedUpdates()
        .filter((entry) => publishedAtDate(entry) > cursor)
        .map(toEntryData);
}

/** The `limit` most recent entries, newest first. */
export function getRecentUpdates(limit: number): UpdateEntryData[] {
    return sortedUpdates().slice(0, limit).map(toEntryData);
}

/**
 * Clamp a requested seen-cursor to the newest `publishedAt` in the collection,
 * so a client can't move a user's cursor past entries that haven't been
 * published yet. Returns `null` when the collection is empty (nothing can have
 * been shown, so there's nothing to mark seen).
 */
export function clampSeenCursor(requested: Date): Date | null {
    const newest = sortedUpdates()[0];
    if (!newest) return null;
    const newestAt = publishedAtDate(newest);
    return requested < newestAt ? requested : newestAt;
}
