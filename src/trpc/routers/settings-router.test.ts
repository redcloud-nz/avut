/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { settingsRouter } from "./settings-router";

// The router reads through the `"use cache"` wrappers, which pull in the real Prisma client and
// need a Next.js render store — neither of which the test environment has any business standing
// up. Swap them for the uncached store functions bound to the mock db; the caching itself is not
// this router's contract, only that it revalidates the tag afterwards.
const h = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof createMockPrisma> }));

vi.mock("@/server/cache/organization-settings", async () => {
    const store = await import("@/server/organization-settings-store");
    return {
        ...store,
        getOrganizationSettings: (organizationId: string) =>
            store.readOrganizationSettings(h.db, organizationId),
        revalidateOrganizationSettings: vi.fn(async () => {}),
    };
});

vi.mock("@/server/cache/user-settings", async () => {
    const store = await import("@/server/user-settings-store");
    return {
        ...store,
        getUserSettings: (userId: string) => store.readUserSettings(h.db, userId),
        revalidateUserSettings: vi.fn(async () => {}),
    };
});

describe("settings organization settings", () => {
    const T = {
        // A site-wide administrator, deliberately NOT a member of either organization.
        siteAdmin: UserId.create(),
        // An ordinary member of `bareOrg` holding `organization:update`.
        orgAdmin: UserId.create(),
        // An organization with no `OrganizationConfig` rows at all — what the normal
        // (non-system-admin) org-creation path produces.
        bareOrg: OrganizationId.create(),
        // An organization whose default config rows have been fully materialised — what
        // `systemAdmin.createOrganization` produces.
        seededOrg: OrganizationId.create(),
    };
    const db = createMockPrisma();
    h.db = db;

    beforeAll(async () => {
        for (const [id, name] of [
            [T.siteAdmin, "Site Admin"],
            [T.orgAdmin, "Org Admin"],
        ] as const) {
            await db.user.create({
                data: {
                    id,
                    name,
                    email: `${id}@x.test`,
                    emailVerified: true,
                    createdAt: new Date(),
                },
            });
        }
        await db.organization.create({
            data: { id: T.bareOrg, name: "Bare", slug: "bare", createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.seededOrg, name: "Seeded", slug: "seeded", createdAt: new Date() },
        });

        for (const [key, value] of Object.entries(
            OrganizationSettings.flatten(OrganizationSettings.default()),
        )) {
            await db.organizationConfig.create({
                data: { organizationId: T.seededOrg, key, value },
            });
        }
    });

    /** A site-wide admin with no membership anywhere — takes the `allowSystemAdmin` bypass. */
    const asSiteAdmin = () =>
        settingsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.siteAdmin, role: "admin" },
                prisma: db,
            }),
        );

    /** An ordinary org admin — takes the usual `hasPermission` path. */
    const asOrgAdmin = () =>
        settingsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.orgAdmin },
                permissions: { organization: ["view", "update"] },
                prisma: db,
            }),
        );

    it("getOrganizationSettings resolves defaults for a config-less organization", async () => {
        const settings = await asSiteAdmin().getOrganizationSettings({
            organizationId: T.bareOrg,
        });
        expect(settings).toEqual(OrganizationSettings.default());
    });

    it("getOrganizationSettings resolves a fully materialised organization identically", async () => {
        const settings = await asSiteAdmin().getOrganizationSettings({
            organizationId: T.seededOrg,
        });
        expect(settings).toEqual(OrganizationSettings.default());
    });

    it("lets a site admin enable a module for an org they do not belong to", async () => {
        const next = OrganizationSettings.default();
        next.modules.notes.enabled = true;

        const result = await asSiteAdmin().updateOrganizationSettings({
            organizationId: T.bareOrg,
            settings: next,
        });

        expect(result.modules.notes.enabled).toBe(true);

        // Persisted, and only the changed leaf was materialised.
        const rows = await db.organizationConfig.findMany({
            where: { organizationId: T.bareOrg },
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ key: "modules.notes.enabled", value: true });

        const reread = await asSiteAdmin().getOrganizationSettings({
            organizationId: T.bareOrg,
        });
        expect(reread.modules.notes.enabled).toBe(true);
    });

    it("lets an in-org admin write through the same procedure", async () => {
        const next = OrganizationSettings.default();
        next.modules.notes.enabled = true;
        next.modules["d4h-views"].enabled = true;

        const result = await asOrgAdmin().updateOrganizationSettings({
            organizationId: T.bareOrg,
            settings: next,
        });

        expect(result.modules["d4h-views"].enabled).toBe(true);
    });

    it("updates an existing config row on a fully materialised organization", async () => {
        const next = OrganizationSettings.default();
        next.modules.i3.enabled = true;
        next.modules.i3.storage = "AVUT";

        const result = await asSiteAdmin().updateOrganizationSettings({
            organizationId: T.seededOrg,
            settings: next,
        });

        expect(result.modules.i3).toEqual({ enabled: true, storage: "AVUT" });

        const row = await db.organizationConfig.findFirst({
            where: { organizationId: T.seededOrg, key: "modules.i3.storage" },
        });
        expect(row?.value).toBe("AVUT");
    });

    it("writes an audit entry against the organization", async () => {
        const next = OrganizationSettings.default();
        next.modules["skill-track"].enabled = true;

        await asSiteAdmin().updateOrganizationSettings({
            organizationId: T.seededOrg,
            settings: next,
        });

        const entries = await db.logEntry.findMany({
            where: { organizationId: T.seededOrg, objectType: "OrganizationSettings" },
        });
        expect(entries.length).toBeGreaterThan(0);
        expect(entries.at(-1)).toMatchObject({
            action: "Update",
            objectType: "OrganizationSettings",
            objectId: T.seededOrg,
            userId: T.siteAdmin,
        });
    });

    it("rejects settings that fail schema validation", async () => {
        const next = OrganizationSettings.default();

        await expect(
            asSiteAdmin().updateOrganizationSettings({
                organizationId: T.bareOrg,
                settings: {
                    ...next,
                    modules: {
                        ...next.modules,
                        notes: { enabled: 7 as unknown as boolean },
                    },
                },
            }),
        ).rejects.toBeTruthy();
    });

    it("rejects a non-member who is not a site admin", async () => {
        const caller = settingsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: UserId.create() },
                prisma: db,
            }),
        );
        await expect(
            caller.getOrganizationSettings({ organizationId: T.bareOrg }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a member who lacks organization:update on a write", async () => {
        const caller = settingsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: UserId.create() },
                permissions: { organization: ["view"] },
                prisma: db,
            }),
        );
        await expect(
            caller.updateOrganizationSettings({
                organizationId: T.bareOrg,
                settings: OrganizationSettings.default(),
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
});
