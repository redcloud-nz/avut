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
    const entry = (version: string) => ({
        slug: `v${version}`,
        version,
        title: undefined,
        description: undefined,
        mdx: `compiled v${version}`,
        content: `body v${version}`,
        _meta: { path: `v${version}` },
    });
    return { allUpdates: [entry("0.9"), entry("0.10"), entry("0.11")] };
});

describe("whatsNewRouter", () => {
    // Dataset — one user per scenario, so the markSeen writes don't interfere:
    //   fresh        → no cursor (seen nothing)
    //   caughtUp     → cursor at 0.10
    //   clamp        → no cursor; markSeen past the newest entry
    //   advance      → cursor at 0.9; markSeen forward
    //   backwards    → cursor at 0.11; markSeen earlier
    //   impersonated → no cursor; everything while impersonated
    const T = {
        fresh: UserId.create(),
        caughtUp: UserId.create(),
        clamp: UserId.create(),
        advance: UserId.create(),
        backwards: UserId.create(),
        impersonated: UserId.create(),
    };

    const seed: Record<keyof typeof T, string | null> = {
        fresh: null,
        caughtUp: "0.10",
        clamp: null,
        advance: "0.9",
        backwards: "0.11",
        impersonated: null,
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
                    lastSeenUpdatesVersion: seed[key],
                },
            });
        }
    });

    function makeCaller(key: keyof typeof T, impersonatedBy: string | null = null) {
        return whatsNewRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T[key] },
                session: { impersonatedBy },
                prisma: db,
            }),
        );
    }

    async function cursorOf(key: keyof typeof T) {
        const user = await db.user.findUniqueOrThrow({ where: { id: T[key] } });
        return user.lastSeenUpdatesVersion;
    }

    describe("getUnseen", () => {
        it("returns every entry when the cursor is null", async () => {
            const { entries } = await makeCaller("fresh").getUnseen();
            expect(entries.map((e) => e.version)).toEqual(["0.11", "0.10", "0.9"]);
        });

        it("returns the releases newer than the cursor", async () => {
            const { entries } = await makeCaller("caughtUp").getUnseen();
            expect(entries.map((e) => e.version)).toEqual(["0.11"]);
        });

        it("returns nothing while impersonated", async () => {
            const { entries } = await makeCaller("impersonated", UserId.create()).getUnseen();
            expect(entries).toEqual([]);
        });
    });

    describe("listRecent", () => {
        it("returns the most recent entries, newest first", async () => {
            const { entries } = await makeCaller("caughtUp").listRecent();
            expect(entries.map((e) => e.version)).toEqual(["0.11", "0.10", "0.9"]);
        });
    });

    describe("markSeen", () => {
        it("clamps the cursor to the newest entry", async () => {
            await makeCaller("clamp").markSeen({ through: "0.12" });
            expect(await cursorOf("clamp")).toBe("0.11");
        });

        it("advances the cursor to the version shown", async () => {
            await makeCaller("advance").markSeen({ through: "0.10" });
            expect(await cursorOf("advance")).toBe("0.10");
        });

        it("never moves the cursor backwards", async () => {
            await makeCaller("backwards").markSeen({ through: "0.9" });
            expect(await cursorOf("backwards")).toBe("0.11");
        });

        it("doesn't write while impersonated", async () => {
            await makeCaller("impersonated", UserId.create()).markSeen({ through: "0.11" });
            expect(await cursorOf("impersonated")).toBeNull();
        });

        it("rejects a non-version input", async () => {
            await expect(makeCaller("advance").markSeen({ through: "v0.10" })).rejects.toThrow();
        });
    });
});
