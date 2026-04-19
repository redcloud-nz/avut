/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { Person as PersonRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { propertiesSchema, recordStatusSchema, tagsSchema, zodNanoId16 } from "../validation";

export const PersonId = {
    schema: zodNanoId16("PersonId expected").brand<"PersonId">(),

    create: (): PersonId => PersonId.schema.parse(nanoId16()),
} as const;

export type PersonId = string & z.BRAND<"PersonId">;

const personSchema = z.object({
    id: PersonId.schema,
    name: z.string().min(5).max(100),
    email: z.email(),
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
