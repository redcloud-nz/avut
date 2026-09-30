/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it, vi } from "vitest";

import {
    clampSeenCursor,
    getAllUpdates,
    getRecentUpdates,
    getUpdatesAfter,
    updatesHref,
} from "@/lib/updates";

// Fixture entries, deliberately out of order, so the tests don't depend on the
// real (growing) corpus.
vi.mock("content-collections", () => {
    const entry = (slug: string, publishedAt: string) => ({
        slug,
        publishedAt,
        title: `Title ${slug}`,
        description: undefined,
        version: undefined,
        mdx: `compiled ${slug}`,
        content: `body ${slug}`,
        _meta: { path: slug },
    });
    return {
        allUpdates: [
            entry("2026-09-01-older", "2026-09-01"),
            entry("2026-09-20-b-second", "2026-09-20"),
            entry("2026-09-25-newest", "2026-09-25"),
            entry("2026-09-20-a-first", "2026-09-20"),
        ],
    };
});

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

describe("updates read model", () => {
    it("sorts newest first, breaking same-day ties by slug", () => {
        expect(getAllUpdates().map((e) => e.slug)).toEqual([
            "2026-09-25-newest",
            "2026-09-20-a-first",
            "2026-09-20-b-second",
            "2026-09-01-older",
        ]);
    });

    it("returns the client payload shape, without the raw source", () => {
        const [first] = getAllUpdates();
        expect(first).toEqual({
            slug: "2026-09-25-newest",
            title: "Title 2026-09-25-newest",
            publishedAt: "2026-09-25",
            description: undefined,
            version: undefined,
            mdx: "compiled 2026-09-25-newest",
        });
    });

    it("treats an entry dated at the cursor as seen", () => {
        expect(getUpdatesAfter(utc("2026-09-20")).map((e) => e.slug)).toEqual([
            "2026-09-25-newest",
        ]);
    });

    it("includes entries after the cursor, newest first", () => {
        expect(getUpdatesAfter(new Date("2026-09-19T23:59:59Z")).map((e) => e.slug)).toEqual([
            "2026-09-25-newest",
            "2026-09-20-a-first",
            "2026-09-20-b-second",
        ]);
    });

    it("returns nothing when the cursor is past the newest entry", () => {
        expect(getUpdatesAfter(utc("2026-09-25"))).toEqual([]);
    });

    it("limits the recent entries", () => {
        expect(getRecentUpdates(2).map((e) => e.slug)).toEqual([
            "2026-09-25-newest",
            "2026-09-20-a-first",
        ]);
    });

    it("clamps a requested cursor later than the newest entry", () => {
        expect(clampSeenCursor(utc("2026-10-15"))).toEqual(utc("2026-09-25"));
    });

    it("leaves a requested cursor at or before the newest entry alone", () => {
        expect(clampSeenCursor(utc("2026-09-20"))).toEqual(utc("2026-09-20"));
        expect(clampSeenCursor(utc("2026-09-25"))).toEqual(utc("2026-09-25"));
    });

    it("builds the updates page href, with an optional anchor", () => {
        expect(updatesHref()).toBe("/docs/updates");
        expect(updatesHref("2026-09-25-newest")).toBe("/docs/updates#2026-09-25-newest");
    });
});
