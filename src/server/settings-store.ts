/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * The read/write machinery behind every settings scope. `organization-settings-store.ts` and
 * `user-settings-store.ts` are both thin bindings of this factory — see either for the concrete
 * signatures.
 *
 * Deliberately free of any `@/server/prisma` import — the Prisma client is injected by the
 * caller so this can be used from tRPC routers (which are exercised from the jsdom test
 * environment against `createMockPrisma()`).
 */

import "server-only";

import * as R from "remeda";

import type { Prisma } from "@/generated/prisma/client";
import { diffObject, type DiffChange } from "@/lib/diff";
import type { SettingsConfigRecord } from "@/lib/schemas/settings-schema";

/**
 * The subset of a Prisma config-model delegate this module drives. `OrganizationConfig` and
 * `UserConfig` differ only in the name of their scope column, so the generated delegate types
 * have no common supertype — the factory narrows to this shape once, at the binding, rather than
 * spreading casts through the algorithm.
 */
interface SettingsConfigDelegate {
    findMany(args: { where: Record<string, string> }): Promise<{ key: string; value: unknown }[]>;
    deleteMany(args: { where: Record<string, string> }): Prisma.PrismaPromise<unknown>;
    upsert(args: {
        where: Record<string, unknown>;
        create: Record<string, unknown>;
        update: { value: unknown };
    }): Prisma.PrismaPromise<unknown>;
}

/**
 * The part of a `SettingsSchema` this algorithm drives, stated structurally so the store stays
 * decoupled from the schema factory's generics — it needs the settings *type*, not the Zod type.
 */
interface SettingsSchemaLike<TSettings> {
    schema: { parse(value: unknown): TSettings };
    default(): TSettings;
    flatten(settings: TSettings): Record<string, unknown>;
    fromRecords(records: SettingsConfigRecord[]): TSettings;
}

interface SettingsTransactor {
    $transaction(operations: Prisma.PrismaPromise<unknown>[]): Promise<unknown>;
}

export interface SettingsStore<TSettings, TReadPrisma, TWritePrisma> {
    read(prisma: TReadPrisma, scopeId: string): Promise<TSettings>;
    write(
        prisma: TWritePrisma,
        scopeId: string,
        settings: TSettings,
        logEntry?: (changes: DiffChange[]) => Prisma.PrismaPromise<unknown>,
    ): Promise<TSettings>;
}

/**
 * Bind the settings read/write algorithm to one config model.
 *
 * @param settings The scope's schema helpers (`OrganizationSettings`, `UserSettings`, …).
 * @param model Picks the delegate off the injected client — `"organizationConfig"`/`"userConfig"`.
 * @param scopeField That model's scope column — `"organizationId"`/`"userId"`.
 */
export function createSettingsStore<
    TSettings,
    TReadPrisma extends object,
    TWritePrisma extends TReadPrisma,
>({
    settings: settingsSchema,
    model,
    scopeField,
}: {
    settings: SettingsSchemaLike<TSettings>;
    model: "organizationConfig" | "userConfig";
    scopeField: "organizationId" | "userId";
}): SettingsStore<TSettings, TReadPrisma, TWritePrisma> {
    const delegateOf = (prisma: object) =>
        (prisma as Record<string, unknown>)[model] as SettingsConfigDelegate;

    async function read(prisma: TReadPrisma, scopeId: string): Promise<TSettings> {
        const records = await delegateOf(prisma).findMany({ where: { [scopeField]: scopeId } });

        return settingsSchema.fromRecords(records);
    }

    async function write(
        prisma: TWritePrisma,
        scopeId: string,
        next: TSettings,
        logEntry?: (changes: DiffChange[]) => Prisma.PrismaPromise<unknown>,
    ): Promise<TSettings> {
        // Validate before writing — the settings may have come straight off the wire.
        const parsed = settingsSchema.schema.parse(next);

        const existing = await read(prisma, scopeId);

        const flattenedExisting = settingsSchema.flatten(existing);
        const flattenedNext = settingsSchema.flatten(parsed);
        const flattenedDefaults = settingsSchema.flatten(settingsSchema.default());

        const delegate = delegateOf(prisma);

        const writes = R.pipe(
            R.entries(flattenedNext),
            R.filter(([key, newValue]) => newValue !== flattenedExisting[key]),
            R.map(([key, value]) =>
                value === flattenedDefaults[key]
                    ? delegate.deleteMany({ where: { [scopeField]: scopeId, key } })
                    : delegate.upsert({
                          where: { [`${scopeField}_key`]: { [scopeField]: scopeId, key } },
                          create: { [scopeField]: scopeId, key, value },
                          update: { value },
                      }),
            ),
        );

        const changes = diffObject(
            existing as Record<string, unknown>,
            parsed as Record<string, unknown>,
        );

        await (prisma as unknown as SettingsTransactor).$transaction([
            ...writes,
            ...(logEntry ? [logEntry(changes)] : []),
        ]);

        return await read(prisma, scopeId);
    }

    return { read, write };
}
