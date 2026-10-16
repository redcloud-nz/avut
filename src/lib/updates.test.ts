/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    clampSeenVersion,
    compareVersions,
    getAllUpdates,
    getNewestUpdateVersion,
    getRecentUpdates,
    getUpdatesAfter,
    updatesHref,
} from "@/lib/updates";

function entry(version: string, title?: string) {
    return {
        slug: `v${version}`,
        version,
        title,
        description: undefined,
        mdx: `compiled v${version}`,
        content: `body v${version}`,
        _meta: { path: `v${version}` },
    };
}

// Fixture entries, deliberately out of order (and out of string order: 0.10 > 0.9), so the tests
// don't depend on the real (growing) corpus. Mutable per test; reset in `beforeEach`.
function defaultEntries() {
    return [entry("0.9"), entry("0.10.1"), entry("0.11", "Eleven"), entry("0.10")];
}

const fixture = vi.hoisted(() => ({ entries: [] as ReturnType<typeof entry>[] }));

vi.mock("content-collections", () => ({
    get allUpdates() {
        return fixture.entries;
    },
}));

const versions = (entries: { version: string }[]) => entries.map((e) => e.version);

describe("compareVersions", () => {
    it("compares numerically, segment by segment", () => {
        expect(compareVersions("0.9", "0.10")).toBeLessThan(0);
        expect(compareVersions("0.10.1", "0.10")).toBeGreaterThan(0);
        expect(compareVersions("1.0", "0.99")).toBeGreaterThan(0);
    });

    it("treats a missing segment as 0", () => {
        expect(compareVersions("0.10", "0.10.0")).toBe(0);
    });
});

describe("updates read model", () => {
    beforeEach(() => {
        fixture.entries = defaultEntries();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("sorts newest version first", () => {
        expect(versions(getAllUpdates())).toEqual(["0.11", "0.10.1", "0.10", "0.9"]);
    });

    it("returns the client payload shape, defaulting the title", () => {
        const [first, second] = getAllUpdates();
        expect(first).toEqual({
            slug: "v0.11",
            version: "0.11",
            title: "Eleven",
            description: undefined,
            mdx: "compiled v0.11",
        });
        expect(second.title).toBe("Version 0.10.1");
    });

    it("returns entries newer than the cursor, newest first", () => {
        expect(versions(getUpdatesAfter("0.10"))).toEqual(["0.11", "0.10.1"]);
    });

    it("returns every entry for a null cursor", () => {
        expect(versions(getUpdatesAfter(null))).toEqual(["0.11", "0.10.1", "0.10", "0.9"]);
    });

    it("returns nothing when the cursor is at the newest entry", () => {
        expect(getUpdatesAfter("0.11")).toEqual([]);
    });

    it("limits the recent entries", () => {
        expect(versions(getRecentUpdates(2))).toEqual(["0.11", "0.10.1"]);
    });

    it("clamps a requested cursor newer than the newest entry", () => {
        expect(clampSeenVersion("0.12")).toBe("0.11");
    });

    it("leaves a requested cursor at or before the newest entry alone", () => {
        expect(clampSeenVersion("0.10")).toBe("0.10");
        expect(clampSeenVersion("0.11")).toBe("0.11");
    });

    it("handles an empty collection", () => {
        fixture.entries = [];
        expect(getAllUpdates()).toEqual([]);
        expect(getNewestUpdateVersion()).toBeNull();
        expect(clampSeenVersion("0.11")).toBeNull();
    });

    describe("in production", () => {
        beforeEach(() => {
            vi.stubEnv("APP_RELEASE_VERSION", "0.10.1");
        });

        it("hides entries for releases newer than the running one", () => {
            expect(versions(getAllUpdates())).toEqual(["0.10.1", "0.10", "0.9"]);
            expect(versions(getUpdatesAfter(null))).toEqual(["0.10.1", "0.10", "0.9"]);
            expect(getNewestUpdateVersion()).toBe("0.10.1");
        });

        it("clamps to the newest released entry", () => {
            expect(clampSeenVersion("0.11")).toBe("0.10.1");
        });
    });

    it("builds the updates page href, with an optional anchor", () => {
        expect(updatesHref()).toBe("/docs/updates");
        expect(updatesHref("v0.11")).toBe("/docs/updates#v0.11");
    });
});
