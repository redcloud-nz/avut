/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Read/write access to the `UserConfig` rows backing a user's settings. The algorithm lives in
 * `settings-store.ts` and is shared with `services/organization-settings.ts`; this file is just its
 * binding to the user scope.
 *
 * Deliberately free of any `@/server/prisma` import — the Prisma client is injected by the
 * caller so this can be used from tRPC routers (which are exercised from the jsdom test
 * environment against `createMockPrisma()`).
 */

import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { UserSettings } from "@/lib/schemas/user-settings";
import { createSettingsStore } from "@/server/settings-store";

/** The slice of the Prisma client the write path needs. */
export type UserSettingsPrisma = Pick<PrismaClient, "userConfig" | "$transaction">;

const store = createSettingsStore<
    UserSettings,
    Pick<PrismaClient, "userConfig">,
    UserSettingsPrisma
>({
    settings: UserSettings,
    model: "userConfig",
    scopeField: "userId",
});

/**
 * Read a user's settings straight from the database (uncached).
 *
 * Missing `UserConfig` rows fall back to `UserSettings.default()`, so this returns an
 * identical result for a config-less user and for one whose defaults have been fully
 * materialised.
 */
export const readUserSettings = store.read;

/**
 * Persist a user's settings, writing only the `UserConfig` rows whose value actually changed
 * relative to the currently-resolved settings.
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
 * `writeUserSettingsSlice` instead. Kept as the primitive that slice writes are built on.
 *
 * @returns the user's settings as they stand after the write.
 */
export const writeUserSettings = store.write;

/**
 * Persist a patch to a single slice of the user's settings — the fields of one settings group
 * that changed, rather than the whole tree.
 *
 * The patch is merged onto the settings as they stand in the database, not onto the snapshot the
 * caller was holding, so a concurrent edit to a different group survives. Everything else
 * (leaf-level diffing, revert-to-default deletes, the in-transaction audit entry) is
 * `writeUserSettings`.
 *
 * @returns the user's settings as they stand after the write.
 */
export const writeUserSettingsSlice = store.writeSlice;

/**
 * Whether a user has a `UserConfig` row for `display.timeZone`, as opposed to it resolving to
 * `UserSettings.default().display.timeZone` for lack of one.
 *
 * Backs the client's one-time browser-zone auto-detection (`TimeZoneAutoDetect`), which only
 * fires while this is `false`. A row-existence check rather than comparing the resolved value
 * against the default: the write path deletes a leaf's row when it's set back to its default
 * (see `writeUserSettings`), so a user whose real zone happens to match the schema default will
 * never accumulate a row here either — harmless, since auto-detection then re-proposes the same
 * value each load and the store's own existing-vs-next diff turns that into a no-op write.
 */
export async function hasExplicitUserTimeZone(
    prisma: Pick<PrismaClient, "userConfig">,
    userId: string,
): Promise<boolean> {
    const row = await prisma.userConfig.findFirst({ where: { userId, key: "display.timeZone" } });
    return row !== null;
}
