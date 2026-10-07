/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Read model over the compiled `updates` content collection (the "What's new"
 * entries, one per release). Pure data — safe to import from server components
 * and route handlers (no `server-only` deps).
 *
 * Production shows only entries for releases up to the one it's running
 * (`APP_RELEASE_VERSION`), so a release's entry can be drafted on `integration`
 * ahead of time; every other environment shows them all. An entry is unseen by
 * a user when its version is newer than their `User.lastSeenUpdatesVersion`
 * (null: they've seen none). See content/updates/README.md.
 */

import { allUpdates, type Update } from "content-collections";

import { env } from "@/lib/env";
import { compareVersions, type UpdateEntryData } from "@/lib/updates-shared";

export type { UpdateEntryData };
export { compareVersions, updatesHref } from "@/lib/updates-shared";

function toEntryData(entry: Update): UpdateEntryData {
    return {
        slug: entry.slug,
        version: entry.version,
        title: entry.title ?? `Version ${entry.version}`,
        description: entry.description,
        mdx: entry.mdx,
    };
}

/** The entries this deployment shows, newest version first. */
function visibleUpdates(): Update[] {
    const releasedThrough = env.APP_RELEASE_VERSION;
    return allUpdates
        .filter((entry) => !releasedThrough || compareVersions(entry.version, releasedThrough) <= 0)
        .sort((a, b) => compareVersions(b.version, a.version));
}

/** Every visible entry, newest first. */
export function getAllUpdates(): UpdateEntryData[] {
    return visibleUpdates().map(toEntryData);
}

/** Visible entries for releases newer than `seen` (all of them when it's null), newest first. */
export function getUpdatesAfter(seen: string | null): UpdateEntryData[] {
    return visibleUpdates()
        .filter((entry) => seen === null || compareVersions(entry.version, seen) > 0)
        .map(toEntryData);
}

/** The `limit` most recent visible entries, newest first. */
export function getRecentUpdates(limit: number): UpdateEntryData[] {
    return visibleUpdates().slice(0, limit).map(toEntryData);
}

/** The newest visible entry's version, or `null` when there are none. */
export function getNewestUpdateVersion(): string | null {
    return visibleUpdates()[0]?.version ?? null;
}

/**
 * Clamp a requested seen-cursor to the newest visible version, so a client
 * can't move a user's cursor past entries this deployment hasn't shown yet.
 * Returns `null` when nothing is visible (so there's nothing to mark seen).
 */
export function clampSeenVersion(requested: string): string | null {
    const newest = getNewestUpdateVersion();
    if (!newest) return null;
    return compareVersions(requested, newest) < 0 ? requested : newest;
}
