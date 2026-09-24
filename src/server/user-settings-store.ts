/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Read/write access to the `UserConfig` rows backing a user's settings. Mirrors
 * `organization-settings-store.ts` — see that file for the rationale behind the shape.
 *
 * Deliberately free of any `@/server/prisma` import — the Prisma client is injected by the
 * caller so this can be used from tRPC routers (which are exercised from the jsdom test
 * environment against `createMockPrisma()`).
 */

import "server-only";

import * as R from "remeda";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { diffObject, type DiffChange } from "@/lib/diff";
import { UserSettings } from "@/lib/schemas/user-settings";

/** The slice of the Prisma client this module needs. */
export type UserSettingsPrisma = Pick<PrismaClient, "userConfig" | "$transaction">;

/**
 * Read a user's settings straight from the database (uncached).
 *
 * Missing `UserConfig` rows fall back to `UserSettings.default()`, so this returns an
 * identical result for a config-less user and for one whose defaults have been fully
 * materialised.
 */
export async function readUserSettings(
    prisma: Pick<PrismaClient, "userConfig">,
    userId: string,
): Promise<UserSettings> {
    const records = await prisma.userConfig.findMany({ where: { userId } });

    return UserSettings.fromRecords(records);
}

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
export async function writeUserSettings(
    prisma: UserSettingsPrisma,
    userId: string,
    settings: UserSettings,
    logEntry?: (changes: DiffChange[]) => Prisma.PrismaPromise<unknown>,
): Promise<UserSettings> {
    // Validate before writing — the settings may have come straight off the wire.
    const parsed = UserSettings.schema.parse(settings);

    const existing = await readUserSettings(prisma, userId);

    const flattenedExisting = UserSettings.flatten(existing);
    const flattenedNext = UserSettings.flatten(parsed);

    const flattenedDefaults = UserSettings.flatten(UserSettings.default());

    const writes = R.pipe(
        R.entries(flattenedNext),
        R.filter(([key, newValue]) => newValue !== flattenedExisting[key]),
        R.map(([key, value]) =>
            value === flattenedDefaults[key]
                ? prisma.userConfig.deleteMany({ where: { userId, key } })
                : prisma.userConfig.upsert({
                      where: { userId_key: { userId, key } },
                      create: { userId, key, value },
                      update: { value },
                  }),
        ),
    );

    const changes = diffObject(existing, parsed);

    await prisma.$transaction([...writes, ...(logEntry ? [logEntry(changes)] : [])]);

    return await readUserSettings(prisma, userId);
}
