/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { UserNote as UserNoteRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { NoteContent, NoteTitle } from "./note-fields";

export type { UserNoteRecord };

export const UserNoteId = {
    schema: zodNanoId16("UserNoteId expected").brand<"UserNoteId">(),

    create: (): UserNoteId => UserNoteId.schema.parse(nanoId16()),
} as const;

export type UserNoteId = string & z.BRAND<"UserNoteId">;

const userNoteSchema = z.object({
    id: UserNoteId.schema,
    userId: z.string(),
    title: NoteTitle.schema,
    content: NoteContent.schema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const UserNoteData = {
    schema: userNoteSchema,

    /** Input for creating a note: a title, and optionally its markdown body. */
    createSchema: z.object({
        title: NoteTitle.schema,
        content: NoteContent.schema.optional(),
    }),

    /** Input for updating a note: a title and/or a body, at least one of them. */
    updateSchema: z
        .object({
            title: NoteTitle.schema.optional(),
            content: NoteContent.schema.optional(),
        })
        .refine(
            (update) => update.title !== undefined || update.content !== undefined,
            "Nothing to update.",
        ),

    fromRecord: (record: UserNoteRecord): UserNoteData =>
        userNoteSchema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        }),
} as const;

export type UserNoteData = z.infer<typeof userNoteSchema>;

export type CreateUserNoteData = z.infer<typeof UserNoteData.createSchema>;

export type UpdateUserNoteData = z.infer<typeof UserNoteData.updateSchema>;
