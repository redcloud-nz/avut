/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Read/write access to the `OrganizationConfig` rows backing an organization's settings. The
 * algorithm lives in `settings-store.ts` and is shared with `user-settings-store.ts`; this file
 * is just its binding to the organization scope.
 *
 * Deliberately free of any `@/server/prisma` import — the Prisma client is injected by the
 * caller so this can be used from tRPC routers (which are exercised from the jsdom test
 * environment against `createMockPrisma()`).
 */

import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { createSettingsStore } from "@/server/settings-store";

/** The slice of the Prisma client the write path needs. */
export type OrganizationSettingsPrisma = Pick<PrismaClient, "organizationConfig" | "$transaction">;

const store = createSettingsStore<
    OrganizationSettings,
    Pick<PrismaClient, "organizationConfig">,
    OrganizationSettingsPrisma
>({
    settings: OrganizationSettings,
    model: "organizationConfig",
    scopeField: "organizationId",
});

/**
 * Read an organization's settings straight from the database (uncached).
 *
 * Missing `OrganizationConfig` rows fall back to `OrganizationSettings.default()`, so this
 * returns an identical result for a config-less organization and for one whose defaults have
 * been fully materialised.
 */
export const read = store.read;

/**
 * Persist an organization's settings, writing only the `OrganizationConfig` rows whose value
 * actually changed relative to the currently-resolved settings.
 *
 * A changed leaf whose new value equals its default has its row deleted rather than upserted,
 * so a setting that is toggled and then reverted goes back to inheriting the default.
 *
 * `logEntry` is invoked with the computed changes and its `PrismaPromise` is executed inside
 * the same `$transaction` as the config writes, so the audit entry can never drift from the
 * write.
 *
 * No tRPC procedure exposes this: a whole-tree write built from a client's snapshot reverts any
 * leaf another writer changed in the meantime, which is why the settings cards go through
 * `writeSlice` instead. Kept as the primitive that slice writes are built on.
 *
 * @returns the organization's settings as they stand after the write.
 */
export const write = store.write;

/**
 * Persist a patch to a single slice of the organization's settings — the fields of one settings group
 * that changed, rather than the whole tree.
 *
 * The patch is merged onto the settings as they stand in the database, not onto the snapshot the
 * caller was holding, so a concurrent edit to a different group survives. Everything else
 * (leaf-level diffing, revert-to-default deletes, the in-transaction audit entry) is `write`.
 *
 * @returns the organization's settings as they stand after the write.
 */
export const writeSlice = store.writeSlice;
