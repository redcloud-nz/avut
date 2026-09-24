/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Prisma } from "@/generated/prisma/client";
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
                // `flatten` types a leaf as `unknown` — it is whatever JSON that path declares.
                data: { organizationId: T.seededOrg, key, value: value as Prisma.InputJsonValue },
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
        const result = await asSiteAdmin().updateOrganizationSettingsSlice({
            organizationId: T.bareOrg,
            update: { slice: "modules.notes", patch: { enabled: true } },
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
        const result = await asOrgAdmin().updateOrganizationSettingsSlice({
            organizationId: T.bareOrg,
            update: { slice: "modules.d4h-views", patch: { enabled: true } },
        });

        expect(result.modules["d4h-views"].enabled).toBe(true);
    });

    it("updates an existing config row on a fully materialised organization", async () => {
        const result = await asSiteAdmin().updateOrganizationSettingsSlice({
            organizationId: T.seededOrg,
            update: { slice: "modules.i3", patch: { enabled: true, storage: "AVUT" } },
        });

        expect(result.modules.i3).toEqual({ enabled: true, storage: "AVUT" });

        const row = await db.organizationConfig.findFirst({
            where: { organizationId: T.seededOrg, key: "modules.i3.storage" },
        });
        expect(row?.value).toBe("AVUT");
    });

    it("leaves the rest of a slice alone when the patch names one field", async () => {
        await asSiteAdmin().updateOrganizationSettingsSlice({
            organizationId: T.seededOrg,
            update: { slice: "modules.i3", patch: { enabled: true, storage: "AVUT" } },
        });

        const settings = await asSiteAdmin().updateOrganizationSettingsSlice({
            organizationId: T.seededOrg,
            update: { slice: "modules.i3", patch: { storage: "D4H" } },
        });

        // `enabled` is absent from the second patch, so it keeps the value the first one set —
        // even though "D4H" is the default for `storage` and so deletes that row.
        expect(settings.modules.i3).toEqual({ enabled: true, storage: "D4H" });

        const rows = await db.organizationConfig.findMany({
            where: { organizationId: T.seededOrg, key: { startsWith: "modules.i3" } },
        });
        expect(rows.map((r) => r.key)).toEqual(["modules.i3.enabled"]);
    });

    it("does not clobber a concurrent edit to another slice", async () => {
        // The case the whole-tree write got wrong: A reads, B writes a different group, A saves.
        // A's payload used to carry its stale copy of B's leaf and revert it.
        const beforeA = await asSiteAdmin().getOrganizationSettings({
            organizationId: T.bareOrg,
        });
        expect(beforeA.integrations.email.enabled).toBe(true);

        // B turns the email integration off while A is still holding `beforeA`.
        await asSiteAdmin().updateOrganizationSettingsSlice({
            organizationId: T.bareOrg,
            update: { slice: "integrations.email", patch: { enabled: false } },
        });

        // A now saves its own card, having never seen B's change.
        const afterA = await asSiteAdmin().updateOrganizationSettingsSlice({
            organizationId: T.bareOrg,
            update: { slice: "personnel", patch: { autoLinkOnInviteAccept: true } },
        });

        expect(afterA.personnel.autoLinkOnInviteAccept).toBe(true);
        expect(afterA.integrations.email.enabled).toBe(false);
    });

    it("writes an audit entry against the organization, naming the slice", async () => {
        await asSiteAdmin().updateOrganizationSettingsSlice({
            organizationId: T.seededOrg,
            update: { slice: "modules.skill-track", patch: { enabled: true } },
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
            description: "Updated modules.skill-track settings",
        });
    });

    it("rejects a patch field that fails schema validation", async () => {
        await expect(
            asSiteAdmin().updateOrganizationSettingsSlice({
                organizationId: T.bareOrg,
                update: {
                    slice: "modules.notes",
                    patch: { enabled: 7 as unknown as boolean },
                },
            }),
        ).rejects.toBeTruthy();
    });

    it("rejects an unknown slice", async () => {
        await expect(
            asSiteAdmin().updateOrganizationSettingsSlice({
                organizationId: T.bareOrg,
                update: { slice: "nope" as "personnel", patch: {} },
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
            caller.updateOrganizationSettingsSlice({
                organizationId: T.bareOrg,
                update: { slice: "personnel", patch: { autoLinkOnPersonCreate: true } },
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
});

describe("settings hasUserTimeZonePreference", () => {
    const db = createMockPrisma();

    function makeCaller() {
        const userId = UserId.create();
        return {
            userId,
            caller: settingsRouter.createCaller(
                createAuthenticatedMockContext({ user: { id: userId }, prisma: db }),
            ),
        };
    }

    it("is false for a user with no display.timeZone row", async () => {
        const { caller } = makeCaller();
        await expect(caller.hasUserTimeZonePreference()).resolves.toBe(false);
    });

    it("becomes true once the user saves a non-default zone", async () => {
        const { caller } = makeCaller();
        await caller.updateUserSettingsSlice({
            update: { slice: "display", patch: { timeZone: "America/New_York" } },
        });

        await expect(caller.hasUserTimeZonePreference()).resolves.toBe(true);
    });

    it("goes back to false once the zone is reverted to the schema default", async () => {
        const { caller } = makeCaller();
        await caller.updateUserSettingsSlice({
            update: { slice: "display", patch: { timeZone: "America/New_York" } },
        });
        await caller.updateUserSettingsSlice({
            update: { slice: "display", patch: { timeZone: "Pacific/Auckland" } },
        });

        // Matches `writeUserSettings`'s revert-to-default behaviour: setting a leaf back to its
        // default deletes the row rather than storing it, so this is indistinguishable from
        // never having set it — see `hasExplicitUserTimeZone`'s docstring.
        await expect(caller.hasUserTimeZonePreference()).resolves.toBe(false);
    });

    it("rejects an unauthenticated caller", async () => {
        const caller = settingsRouter.createCaller({
            prisma: db,
            auth: null,
            hasPermission: async () => {},
            getHeaders: async () => new Headers(),
        });
        await expect(caller.hasUserTimeZonePreference()).rejects.toMatchObject({
            code: "UNAUTHORIZED",
        });
    });
});
