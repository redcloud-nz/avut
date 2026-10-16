/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { UserNote as UserNoteRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { NoteContent, NoteCreateInput, NoteTitle, NoteUpdateInput } from "./note-fields";

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

    /** Input for creating a note; see {@link NoteCreateInput}. */
    createSchema: NoteCreateInput.schema,

    /** Unrefined input for updating a note; apply {@link NoteUpdateInput.refine} to the full input. */
    updateSchema: NoteUpdateInput.schema,

    /** A note as the list shows it: no `content`. */
    listItemSchema: userNoteSchema.pick({
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
    }),

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

export type UserNoteListItem = z.infer<typeof UserNoteData.listItemSchema>;
