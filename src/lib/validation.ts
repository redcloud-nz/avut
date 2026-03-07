/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";
import { Tmpl } from "./tmpl";

export const zodColor = z
    .string()
    .regex(/^#[0-9A-F]{6}$/, "Must be a colour in RGB Hex format (eg #4682B4)");

export const recordStatusParameterSchema = z
    .union([
        z.enum(["Active", "Inactive"]),
        z
            .array(z.enum(["Active", "Inactive"]))
            .min(1)
            .max(2),
    ])
    .optional()
    .default(["Active", "Inactive"])
    .transform((value) => (Array.isArray(value) ? value : [value]));

export const zodSlug = z
    .string()
    .max(100)
    .regex(
        /^[a-zA-Z0-9\-]+$/,
        "Must be url slug format (alphanumeric with hyphens).",
    );

export function zodNanoId8(error?: string) {
    return z.stringFormat("nanoid-8", /^[a-zA-Z0-9]{8}$/, error);
}

export function zodNanoId16(error?: string) {
    return z.stringFormat("nanoid-16", /^[a-zA-Z0-9]{16}$/, error);
}

export const propertiesSchema = z.record(z.string(), z.any());

export const recordStatusSchema = z.enum(["Active", "Archived", "Deleted"]);

export const tagsSchema = z.array(z.string().nonempty());

export type RecordStatus = z.infer<typeof recordStatusSchema>;

export function zodTmplString(availableKeys: string[]) {
    return z.stringFormat(
        "tmpl-string",
        (val) => Tmpl.validate(val, availableKeys),
        "Invalid template string",
    );
}
