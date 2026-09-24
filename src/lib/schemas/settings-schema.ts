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
