/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * The read/write machinery behind every settings scope. `services/organization-settings.ts` and
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
    writeSlice(
        prisma: TWritePrisma,
        scopeId: string,
        path: string[],
        patch: Record<string, unknown>,
        logEntry?: (changes: DiffChange[]) => Prisma.PrismaPromise<unknown>,
    ): Promise<TSettings>;
}

/**
 * Bind the settings read/write algorithm to one config model.
 *
 * @param settings The scope's schema helpers (`OrganizationSettings`, `UserSettings`, …).
 * @param model Picks the delegate off the injected client — `"organizationConfig"`/`"userConfig"`.
 * @param scopeField That model's scope column — `"organizationId"`/`"userId"`.
 * @param normalize Applies the scope's cross-field rules to a validated write: handed the settings
 *     as they stand and as they're about to become, it returns the settings to store, or throws to
 *     refuse the write. Runs before the diff, so anything it changes is written and audited with
 *     the rest.
 */
export function createSettingsStore<
    TSettings,
    TReadPrisma extends object,
    TWritePrisma extends TReadPrisma,
>({
    settings: settingsSchema,
    model,
    scopeField,
    normalize,
}: {
    settings: SettingsSchemaLike<TSettings>;
    model: "organizationConfig" | "userConfig";
    scopeField: "organizationId" | "userId";
    normalize?: (existing: TSettings, next: TSettings) => TSettings;
}): SettingsStore<TSettings, TReadPrisma, TWritePrisma> {
    const delegateOf = (prisma: object) =>
        (prisma as Record<string, unknown>)[model] as SettingsConfigDelegate;

    async function read(prisma: TReadPrisma, scopeId: string): Promise<TSettings> {
        const records = await delegateOf(prisma).findMany({ where: { [scopeField]: scopeId } });

        return settingsSchema.fromRecords(records);
    }

    /**
     * The shared write path. `produce` is handed the settings as they stand *in the database*
     * and returns what they should become, so a caller that merges (`writeSlice`) merges onto
     * current state rather than onto whatever snapshot its client was holding.
     */
    async function writeWith(
        prisma: TWritePrisma,
        scopeId: string,
        produce: (existing: TSettings) => TSettings,
        logEntry?: (changes: DiffChange[]) => Prisma.PrismaPromise<unknown>,
    ): Promise<TSettings> {
        const existing = await read(prisma, scopeId);

        // Validate before writing — the settings may have come straight off the wire.
        const validated = settingsSchema.schema.parse(produce(existing));
        const parsed = normalize ? normalize(existing, validated) : validated;

        const flattenedExisting = settingsSchema.flatten(existing);
        const flattenedNext = settingsSchema.flatten(parsed);
        const flattenedDefaults = settingsSchema.flatten(settingsSchema.default());

        const delegate = delegateOf(prisma);

        const writes = R.pipe(
            R.entries(flattenedNext),
            // Deep equality, because array leaves (`modules.d4h-i3.notify.…`) are fresh objects on
            // every read: `!==` would upsert them on every save, and `===` would never match a
            // `[]` to its default, so its row would never be deleted.
            R.filter(([key, newValue]) => !R.isDeepEqual(newValue, flattenedExisting[key])),
            R.map(([key, value]) =>
                R.isDeepEqual(value, flattenedDefaults[key])
                    ? delegate.deleteMany({ where: { [scopeField]: scopeId, key } })
                    : delegate.upsert({
                          where: { [`${scopeField}_key`]: { [scopeField]: scopeId, key } },
                          create: { [scopeField]: scopeId, key, value },
                          update: { value },
                      }),
            ),
        );

        // A key in the existing settings but not the next one is a dynamic record key that was
        // removed (`modules.d4h-i3.notify.teams.<teamId>`). `existing` is schema-parsed, so a
        // fixed leaf can't go missing this way. Without this, the row would stay and the key
        // would come back on the next read.
        const removals = R.pipe(
            R.keys(flattenedExisting),
            R.filter((key) => !(key in flattenedNext)),
            R.map((key) => delegate.deleteMany({ where: { [scopeField]: scopeId, key } })),
        );

        const changes = diffObject(
            existing as Record<string, unknown>,
            parsed as Record<string, unknown>,
        );

        await (prisma as unknown as SettingsTransactor).$transaction([
            ...writes,
            ...removals,
            ...(logEntry ? [logEntry(changes)] : []),
        ]);

        return await read(prisma, scopeId);
    }

    function write(
        prisma: TWritePrisma,
        scopeId: string,
        settings: TSettings,
        logEntry?: (changes: DiffChange[]) => Prisma.PrismaPromise<unknown>,
    ): Promise<TSettings> {
        return writeWith(prisma, scopeId, () => settings, logEntry);
    }

    function writeSlice(
        prisma: TWritePrisma,
        scopeId: string,
        path: string[],
        patch: Record<string, unknown>,
        logEntry?: (changes: DiffChange[]) => Prisma.PrismaPromise<unknown>,
    ): Promise<TSettings> {
        return writeWith(
            prisma,
            scopeId,
            (existing) => {
                const next = structuredClone(existing) as Record<string, unknown>;

                let cursor = next;
                for (const part of path.slice(0, -1)) {
                    cursor = cursor[part] as Record<string, unknown>;
                }

                // Drop keys the patch left undefined before merging. `.partial()` yields an
                // object with *every* field present, the omitted ones as `undefined`, so a naive
                // spread would blank a field the patch never mentioned — and the re-parse would
                // then quietly substitute that field's schema default. An absent key means
                // "leave alone"; JSON cannot carry `undefined` over the wire anyway.
                const defined = Object.fromEntries(
                    Object.entries(patch).filter(([, value]) => value !== undefined),
                );

                const leaf = path[path.length - 1];
                cursor[leaf] = { ...(cursor[leaf] as Record<string, unknown>), ...defined };

                return next as TSettings;
            },
            logEntry,
        );
    }

    return { read, write, writeSlice };
}
