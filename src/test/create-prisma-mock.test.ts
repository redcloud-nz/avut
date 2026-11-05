import { describe, expect, it } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";

import { createMockPrisma } from "./create-prisma-mock";

const org = (name: string) => ({
    id: OrganizationId.create(),
    name,
    slug: name.toLowerCase(),
    createdAt: new Date(),
});

describe("createMockPrisma", () => {
    it("runs a model call only once it's awaited, as a PrismaPromise does", async () => {
        const db = createMockPrisma();
        const pending = db.organization.create({ data: org("Lazy") });

        expect(await db.organization.count()).toBe(0);
        await pending;
        expect(await db.organization.count()).toBe(1);
    });

    it("returns an array $transaction's results in order", async () => {
        const db = createMockPrisma();
        const [a, b] = await db.$transaction([
            db.organization.create({ data: org("First") }),
            db.organization.create({ data: org("Second") }),
        ]);

        expect([a.name, b.name]).toEqual(["First", "Second"]);
    });

    it("rolls back an array $transaction's earlier writes when a later one throws, and skips the rest", async () => {
        const db = createMockPrisma();
        const kept = org("Kept");
        await db.organization.create({ data: kept });

        await expect(
            db.$transaction([
                db.organization.create({ data: org("Before") }),
                db.organization.update({ where: { id: OrganizationId.create() }, data: {} }),
                db.organization.create({ data: org("After") }),
            ]),
        ).rejects.toThrow();

        const names = (await db.organization.findMany()).map((o) => o.name);
        expect(names).toEqual([kept.name]);
    });

    it("still rolls back an interactive $transaction", async () => {
        const db = createMockPrisma();

        await expect(
            db.$transaction(async (tx) => {
                await tx.organization.create({ data: org("Inside") });
                throw new Error("boom");
            }),
        ).rejects.toThrow("boom");

        expect(await db.organization.count()).toBe(0);
    });
});
