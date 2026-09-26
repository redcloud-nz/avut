/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { Person as PersonRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { propertiesSchema, recordStatusSchema, tagsSchema, zodNanoId16 } from "../validation";

export type { PersonRecord };

export const PersonId = {
    schema: zodNanoId16("PersonId expected").brand<"PersonId">(),

    create: (): PersonId => PersonId.schema.parse(nanoId16()),
} as const;

export type PersonId = string & z.BRAND<"PersonId">;

const personSchema = z.object({
    id: PersonId.schema,
    name: z.string().min(5).max(100),
    /*
     * Lowercased on the way in. `personnel.email` is stored normalised so that
     * `@@unique([organizationId, email])` means what its comment claims — Postgres unique
     * indexes are case-sensitive, so without this two rows in one org may differ only by case.
     * See docs/specs/person-email-normalisation.md.
     *
     * This covers every parsed path. The D4H import builds its person object in code and never
     * parses it, so `Personnel.create` normalises as well.
     */
    email: z.email().toLowerCase(),
    tags: tagsSchema,
    properties: propertiesSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    status: recordStatusSchema,
});

export const PersonData = {
    schema: personSchema,

    modifiableSchema: personSchema.pick({
        name: true,
        email: true,
        tags: true,
        properties: true,
    }),

    fromRecord(record: PersonRecord): PersonData {
        return personSchema.parse({
            ...record,
            createdAt: record?.createdAt?.toISOString(),
            updatedAt: record?.updatedAt?.toISOString(),
        });
    },
} as const;

export type PersonData = z.infer<typeof personSchema>;

export type ModifiablePersonData = z.infer<typeof PersonData.modifiableSchema>;

export const PersonRef = {
    schema: z.object({
        id: PersonId.schema,
        name: z.string(),
    }),
} as const;

export type PersonRef = z.infer<typeof PersonRef.schema>;
