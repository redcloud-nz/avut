/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

/** One persisted config row, as both `OrganizationConfig` and `UserConfig` shape it. */
export interface SettingsConfigRecord {
    key: string;
    value: unknown;
}

/**
 * The helper set every settings tree exposes — see `createSettingsSchema`.
 *
 * Generic over the schema itself rather than just its inferred type, so `schema` keeps its
 * concrete `ZodObject` and callers can still reach through it — the settings dialogs validate
 * their own slice with `UserSettings.schema.shape.display.pick({ dateFormat: true })`.
 */
export interface SettingsSchema<TSchema extends z.ZodObject> {
    schema: TSchema;
    /** A fully-materialised settings object with every leaf at its declared default. */
    default(): z.infer<TSchema>;
    /** The tree flattened to `{ "dot.path.to.leaf": value }`. Arrays count as leaves. */
    flatten(settings: z.infer<TSchema>): Record<string, unknown>;
    /** Stored rows layered over `default()`, then re-parsed. */
    fromRecords(records: SettingsConfigRecord[]): z.infer<TSchema>;
}

/**
 * Build the object skeleton that materialises a schema's defaults.
 *
 * Zod only applies a `.default()` to a key that is *present*, so parsing `{}` against a tree of
 * nested objects fails rather than defaulting. The skeleton supplies `{}` at every plain nested
 * object and stops at anything that carries its own default — a `ZodDefault` wrapping an object
 * (`modules["skill-track"].results`) must be left absent so that object-level default applies.
 *
 * Deriving this from the schema is what keeps `default()` honest: a new settings group used to
 * need a matching hand-written entry in each `default()` skeleton, and forgetting it threw at
 * runtime rather than failing to compile.
 */
function defaultSkeleton(schema: z.ZodType): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    const def = (schema as unknown as { def: { type: string; shape?: Record<string, z.ZodType> } })
        .def;
    if (def.type !== "object" || !def.shape) return out;

    for (const [key, field] of Object.entries(def.shape)) {
        const fieldDef = (field as unknown as { def: { type: string } }).def;
        if (fieldDef.type === "object") out[key] = defaultSkeleton(field);
    }

    return out;
}

/**
 * Wrap a settings schema with the read helpers shared by every settings scope.
 *
 * `OrganizationSettings` and `UserSettings` are the same machinery over different trees — this
 * is that machinery, so a third scope (per-team settings, say) costs only its schema.
 */
export function createSettingsSchema<TSchema extends z.ZodObject>(
    schema: TSchema,
): SettingsSchema<TSchema> {
    type T = z.infer<TSchema>;

    return {
        schema,

        default(): T {
            return schema.parse(defaultSkeleton(schema)) as T;
        },

        flatten(settings: T): Record<string, unknown> {
            const result: Record<string, unknown> = {};

            function recurse(obj: Record<string, unknown>, prefix: string) {
                for (const key in obj) {
                    const value = obj[key];
                    const newKey = prefix ? `${prefix}.${key}` : key;
                    if (value && typeof value === "object" && !Array.isArray(value)) {
                        recurse(value as Record<string, unknown>, newKey);
                    } else {
                        result[newKey] = value;
                    }
                }
            }

            recurse(settings as Record<string, unknown>, "");
            return result;
        },

        fromRecords(records: SettingsConfigRecord[]): T {
            // Start from a fully-defaulted settings object rather than an empty skeleton — some
            // fields (e.g. modules["skill-track"].results) only have a default at the object
            // level, not per-leaf, so reconstructing from a handful of changed leaf keys on top
            // of `{}` would leave the rest of that object undefined instead of falling back to
            // its default.
            const settings = structuredClone(this.default()) as Record<string, unknown>;

            for (const record of records) {
                const parts = record.key.split(".");
                let current = settings;

                for (let i = 0; i < parts.length - 1; i++) {
                    if (current[parts[i]] == undefined) {
                        current[parts[i]] = {};
                    }
                    current = current[parts[i]] as Record<string, unknown>;
                }

                current[parts[parts.length - 1]] = record.value;
            }

            return schema.parse(settings) as T;
        },
    };
}

/**
 * The settings object reachable at a dot path — `PathValue<UserSettings, "display">` is the
 * `display` object, `PathValue<OrganizationSettings, "integrations.d4h">` the D4H one.
 */
export type PathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
    ? Head extends keyof T
        ? PathValue<T[Head], Rest>
        : never
    : P extends keyof T
      ? T[P]
      : never;

/**
 * The wire shape of a slice update: which group, and the fields of it that changed.
 */
export type SettingsSlicePatch<TSettings, TIds extends string> = {
    [K in TIds]: { slice: K; patch: Partial<PathValue<TSettings, K>> };
}[TIds];

export interface SettingsSlices<TSettings, TIds extends string> {
    /** Every declared slice id. */
    ids: readonly TIds[];
    /** The dot path, split — `"integrations.d4h"` → `["integrations", "d4h"]`. */
    pathOf(id: TIds): string[];
    /** A discriminated union over the slices, for a procedure's `.input()`. */
    input: z.ZodType<SettingsSlicePatch<TSettings, TIds>>;
}

/** Walk to the object schema at a dot path, unwrapping any default/optional wrapper. */
function schemaAt(schema: z.ZodObject, path: string[]): z.ZodObject {
    let current: z.ZodType = schema;

    for (const part of path) {
        const def = (
            current as unknown as { def: { type: string; shape?: Record<string, z.ZodType> } }
        ).def;
        if (def.type !== "object" || !def.shape) {
            throw new Error(`Settings slice path "${path.join(".")}" runs through a non-object`);
        }
        const next = def.shape[part];
        if (!next) throw new Error(`Settings slice path "${path.join(".")}" has no key "${part}"`);

        // A slice may sit behind a `.default()`/`.optional()` wrapper; the patch targets the
        // object inside it.
        let unwrapped: z.ZodType = next;
        for (;;) {
            const d = (unwrapped as unknown as { def: { type: string; innerType?: z.ZodType } })
                .def;
            if ((d.type === "default" || d.type === "optional") && d.innerType) {
                unwrapped = d.innerType;
            } else break;
        }
        current = unwrapped;
    }

    return current as z.ZodObject;
}

/**
 * Build the schema a slice patch is validated against: every field optional, and *without* its
 * default.
 *
 * `.partial()` alone is not enough. It makes each key optional, but a key declared
 * `z.boolean().default(false)` still resolves to `false` when omitted rather than staying absent
 * — so a card patching one field would arrive carrying schema defaults for every other field in
 * its slice and silently reset them. Unwrapping `ZodDefault` first is what makes an omitted key
 * mean "leave alone".
 */
function patchSchemaOf(objectSchema: z.ZodObject): z.ZodObject {
    const shape = (objectSchema as unknown as { def: { shape: Record<string, z.ZodType> } }).def
        .shape;

    return z.object(
        Object.fromEntries(
            Object.entries(shape).map(([key, field]) => {
                const def = (field as unknown as { def: { type: string; innerType?: z.ZodType } })
                    .def;
                const undefaulted = def.type === "default" && def.innerType ? def.innerType : field;

                return [key, undefaulted.optional()];
            }),
        ),
    );
}

/**
 * Name the editable groups of a settings tree.
 *
 * A slice is the unit a settings card edits, and `setSlice`-style mutations carry only the
 * fields of one slice that changed — so two cards saving at once no longer overwrite each
 * other's leaves with a stale snapshot. Each slice's patch is validated against that group's own
 * schema, and the merged group is re-parsed in full, so cross-field invariants inside a slice
 * still hold.
 *
 * Note that a patch can only *set* fields, not unset them: an absent key means "leave alone", so
 * an `.optional()` leaf with no explicit null (today only `general.publicDomain`, which no card
 * edits) cannot be cleared through a slice patch.
 */
export function defineSettingsSlices<
    TSchema extends z.ZodObject,
    const TIds extends readonly string[],
>(schema: TSchema, ids: TIds): SettingsSlices<z.infer<TSchema>, TIds[number]> {
    const paths = new Map<string, string[]>(ids.map((id) => [id, id.split(".")]));

    const options = ids.map((id) =>
        z.object({
            slice: z.literal(id),
            patch: patchSchemaOf(schemaAt(schema, paths.get(id)!)),
        }),
    );

    return {
        ids: ids as readonly TIds[number][],
        pathOf(id) {
            const path = paths.get(id);
            if (!path) throw new Error(`Unknown settings slice "${id}"`);
            return path;
        },
        input: z.discriminatedUnion(
            "slice",
            options as unknown as [z.ZodObject, z.ZodObject, ...z.ZodObject[]],
        ) as unknown as z.ZodType<SettingsSlicePatch<z.infer<TSchema>, TIds[number]>>,
    };
}
