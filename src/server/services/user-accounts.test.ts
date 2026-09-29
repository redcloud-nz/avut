/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { recordLogEntry } from "@/server/log-entry";
import { createMockPrisma } from "@/test/create-prisma-mock";

import * as UserAccounts from "./user-accounts";

describe("UserAccounts", () => {
    const T = {
        admin: UserId.create(),
        member: UserId.create(),
        soleOwner: UserId.create(),
        coOwnerA: UserId.create(),
        coOwnerB: UserId.create(),
        soleOrg: OrganizationId.create(),
        sharedOrg: OrganizationId.create(),
    };

    const db = createMockPrisma();
    const actor = { userId: T.admin };

    const ctx: UserAccounts.SystemServiceContext = {
        prisma: db,
        logSystemEvent: (options, tx = db) =>
            recordLogEntry({ scope: "system", actor, actorLabel: "Admin", ...options }, tx),
    };

    beforeAll(async () => {
        for (const [id, name, role] of [
            [T.admin, "Admin", "admin"],
            [T.member, "Mere Member", null],
            [T.soleOwner, "Sole Owner", null],
            [T.coOwnerA, "Co Owner A", null],
            [T.coOwnerB, "Co Owner B", null],
        ] as const) {
            await db.user.create({ data: { id, name, email: `${id}@example.com`, role } });
        }
        for (const [id, name] of [
            [T.soleOrg, "Solo SAR"],
            [T.sharedOrg, "Shared SAR"],
        ] as const) {
            await db.organization.create({ data: { id, name, slug: id, createdAt: new Date() } });
        }
        for (const [organizationId, userId] of [
            [T.soleOrg, T.soleOwner],
            [T.sharedOrg, T.coOwnerA],
            [T.sharedOrg, T.coOwnerB],
        ] as const) {
            await db.organizationUser.create({
                data: { id: nanoId16(), organizationId, userId, role: "owner" },
            });
        }
        await db.session.create({
            data: {
                id: nanoId16(),
                userId: T.member,
                token: nanoId16(),
                expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            },
        });
    });

    it("refuses the last system administrator", async () => {
        expect(await UserAccounts.getDeleteBlocker(ctx, T.admin)).toMatch(
            /last system administrator/,
        );
    });

    it("names the organisations a sole owner would leave ownerless, without blocking", async () => {
        expect(await UserAccounts.getSoleOwnedOrganizations(ctx, T.soleOwner)).toEqual([
            { id: T.soleOrg, name: "Solo SAR" },
        ]);
        expect(await UserAccounts.getSoleOwnedOrganizations(ctx, T.coOwnerA)).toEqual([]);
        expect(await UserAccounts.getDeleteBlocker(ctx, T.soleOwner)).toBeNull();
    });

    it("soft-deletes: status Deleted, sessions revoked, system-scoped Delete entry", async () => {
        await UserAccounts.softDelete(ctx, T.member, "admin");

        expect((await db.user.findUnique({ where: { id: T.member } }))?.status).toBe("Deleted");
        expect(await db.session.count({ where: { userId: T.member } })).toBe(0);
        const [entry] = await db.logEntry.findMany({
            where: { objectType: "User", objectId: T.member, action: "Delete" },
        });
        expect(entry).toMatchObject({ scope: "system", ownerId: null });
    });

    it("lists a deleted account with a 14-day purge date", async () => {
        const [row] = await UserAccounts.listDeleted(db);
        expect(row.id).toBe(T.member);
        expect(row.purgeAt!.getTime() - row.deletedAt!.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
    });

    it("getDeleted returns one account's bin entry, and null for an active account", async () => {
        const [listed] = await UserAccounts.listDeleted(db);
        expect(await UserAccounts.getDeleted(db, T.member)).toEqual(listed);
        expect(await UserAccounts.getDeleted(db, T.coOwnerB)).toBeNull();
    });

    it("a co-owner in the Rubbish bin no longer covers for the other", async () => {
        await UserAccounts.softDelete(ctx, T.coOwnerA, "self");
        expect(await UserAccounts.getSoleOwnedOrganizations(ctx, T.coOwnerB)).toEqual([
            { id: T.sharedOrg, name: "Shared SAR" },
        ]);
    });

    it("purgeExpired purges accounts past their window", async () => {
        const summary = await UserAccounts.purgeExpired(ctx, new Date("2099-01-01"));
        expect(summary.purged).toEqual(expect.arrayContaining([T.member, T.coOwnerA]));
        expect(await db.user.findUnique({ where: { id: T.coOwnerA } })).toBeNull();
    });

    it("purges a deleted account that is an org's only owner — the org is left without one", async () => {
        // Deleted while a co-owner existed; that co-owner has since left the org.
        const id = UserId.create();
        const org = OrganizationId.create();
        await db.user.create({
            data: { id, name: "Left Holding", email: `${id}@example.com`, status: "Deleted" },
        });
        await db.organization.create({
            data: { id: org, name: "Orphan SAR", slug: org, createdAt: new Date() },
        });
        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: org, userId: id, role: "owner" },
        });

        await UserAccounts.purge(ctx, id);
        expect(await db.user.findUnique({ where: { id } })).toBeNull();
        expect(await db.organizationUser.count({ where: { organizationId: org } })).toBe(0);
    });

    it("purge refuses an account that isn't in the Rubbish bin", async () => {
        await expect(UserAccounts.purge(ctx, T.coOwnerB)).rejects.toThrow(
            /isn't in the Rubbish bin/,
        );
    });

    it("recover brings a deleted account back to Active", async () => {
        const id = UserId.create();
        await db.user.create({ data: { id, name: "Back Again", email: `${id}@example.com` } });
        await UserAccounts.softDelete(ctx, id, "self");
        await UserAccounts.recover(ctx, id);
        expect((await db.user.findUnique({ where: { id } }))?.status).toBe("Active");
    });
});
