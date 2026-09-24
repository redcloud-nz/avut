/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Read/write access to the `UserConfig` rows backing a user's settings. The algorithm lives in
 * `settings-store.ts` and is shared with `organization-settings-store.ts`; this file is just its
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
 * @returns the user's settings as they stand after the write.
 */
export const writeUserSettings = store.write;
