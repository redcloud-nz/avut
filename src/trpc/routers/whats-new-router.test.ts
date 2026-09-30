/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { whatsNewRouter } from "./whats-new-router";

// Fixture entries, so the tests don't depend on the real (growing) corpus.
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
            entry("2026-09-20-middle", "2026-09-20"),
            entry("2026-09-25-newest", "2026-09-25"),
        ],
    };
});

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

describe("whatsNewRouter", () => {
    // Dataset — one user per scenario, so the markSeen writes don't interfere:
    //   fresh      → joined 09-10, no cursor (falls back to createdAt)
    //   caughtUp   → joined 01-01, cursor at 09-20
    //   clamp      → joined 01-01, no cursor; markSeen past the newest entry
    //   advance    → joined 01-01, cursor at 09-01; markSeen forward
    //   backwards  → joined 01-01, cursor at 09-25; markSeen earlier
    //   lateJoiner → joined 09-22, no cursor; markSeen earlier than createdAt
    //   impersonated → joined 01-01, no cursor; everything while impersonated
    const T = {
        fresh: UserId.create(),
        caughtUp: UserId.create(),
        clamp: UserId.create(),
        advance: UserId.create(),
        backwards: UserId.create(),
        lateJoiner: UserId.create(),
        impersonated: UserId.create(),
    };

    const seed: Record<keyof typeof T, { createdAt: Date; lastSeenUpdatesAt: Date | null }> = {
        fresh: { createdAt: utc("2026-09-10"), lastSeenUpdatesAt: null },
        caughtUp: { createdAt: utc("2026-01-01"), lastSeenUpdatesAt: utc("2026-09-20") },
        clamp: { createdAt: utc("2026-01-01"), lastSeenUpdatesAt: null },
        advance: { createdAt: utc("2026-01-01"), lastSeenUpdatesAt: utc("2026-09-01") },
        backwards: { createdAt: utc("2026-01-01"), lastSeenUpdatesAt: utc("2026-09-25") },
        lateJoiner: { createdAt: utc("2026-09-22"), lastSeenUpdatesAt: null },
        impersonated: { createdAt: utc("2026-01-01"), lastSeenUpdatesAt: null },
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const key of Object.keys(T) as (keyof typeof T)[]) {
            await db.user.create({
                data: {
                    id: T[key],
                    name: key,
                    email: `${key}@example.com`,
                    emailVerified: true,
                    ...seed[key],
                },
            });
        }
    });

    function makeCaller(key: keyof typeof T, impersonatedBy: string | null = null) {
        return whatsNewRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T[key], createdAt: seed[key].createdAt },
                session: { impersonatedBy },
                prisma: db,
            }),
        );
    }

    async function cursorOf(key: keyof typeof T) {
        const user = await db.user.findUniqueOrThrow({ where: { id: T[key] } });
        return user.lastSeenUpdatesAt;
    }

    describe("getUnseen", () => {
        it("falls back to createdAt when the cursor is null", async () => {
            const { entries } = await makeCaller("fresh").getUnseen();
            expect(entries.map((e) => e.slug)).toEqual(["2026-09-25-newest", "2026-09-20-middle"]);
        });

        it("filters by the stored cursor, counting a same-day entry as seen", async () => {
            const { entries } = await makeCaller("caughtUp").getUnseen();
            expect(entries.map((e) => e.slug)).toEqual(["2026-09-25-newest"]);
        });

        it("returns nothing while impersonated", async () => {
            const { entries } = await makeCaller("impersonated", UserId.create()).getUnseen();
            expect(entries).toEqual([]);
        });
    });

    describe("listRecent", () => {
        it("returns the most recent entries, newest first", async () => {
            const { entries } = await makeCaller("caughtUp").listRecent();
            expect(entries.map((e) => e.slug)).toEqual([
                "2026-09-25-newest",
                "2026-09-20-middle",
                "2026-09-01-older",
            ]);
        });
    });

    describe("markSeen", () => {
        it("clamps the cursor to the newest entry", async () => {
            await makeCaller("clamp").markSeen({ through: "2027-01-01" });
            expect(await cursorOf("clamp")).toEqual(utc("2026-09-25"));
        });

        it("advances the cursor to the date shown", async () => {
            await makeCaller("advance").markSeen({ through: "2026-09-20" });
            expect(await cursorOf("advance")).toEqual(utc("2026-09-20"));
        });

        it("never moves a stored cursor backwards", async () => {
            await makeCaller("backwards").markSeen({ through: "2026-09-01" });
            expect(await cursorOf("backwards")).toEqual(utc("2026-09-25"));
        });

        it("never moves a null cursor behind createdAt", async () => {
            await makeCaller("lateJoiner").markSeen({ through: "2026-09-20" });
            expect(await cursorOf("lateJoiner")).toBeNull();
        });

        it("doesn't write while impersonated", async () => {
            await makeCaller("impersonated", UserId.create()).markSeen({ through: "2026-09-25" });
            expect(await cursorOf("impersonated")).toBeNull();
        });

        it("rejects a non-date input", async () => {
            await expect(
                makeCaller("advance").markSeen({ through: "2026-09-20T00:00:00Z" }),
            ).rejects.toThrow();
        });
    });
});
