/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { OrganizationNote as OrganizationNoteRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { NoteContent, NoteCreateInput, NoteTitle, NoteUpdateInput } from "./note-fields";

export type { OrganizationNoteRecord };

export const OrganizationNoteId = {
    schema: zodNanoId16("OrganizationNoteId expected").brand<"OrganizationNoteId">(),

    create: (): OrganizationNoteId => OrganizationNoteId.schema.parse(nanoId16()),
} as const;

export type OrganizationNoteId = string & z.BRAND<"OrganizationNoteId">;

const organizationNoteSchema = z.object({
    id: OrganizationNoteId.schema,
    organizationId: z.string(),
    /** Null once the author's account has been purged. */
    authorId: z.string().nullable(),
    title: NoteTitle.schema,
    content: NoteContent.schema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const OrganizationNoteData = {
    schema: organizationNoteSchema,

    /** Input for creating a note; see {@link NoteCreateInput}. */
    createSchema: NoteCreateInput.schema,

    /** Unrefined input for updating a note; apply {@link NoteUpdateInput.refine} to the full input. */
    updateSchema: NoteUpdateInput.schema,

    fromRecord: (record: OrganizationNoteRecord): OrganizationNoteData =>
        organizationNoteSchema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        }),
} as const;

export type OrganizationNoteData = z.infer<typeof organizationNoteSchema>;

export type CreateOrganizationNoteData = z.infer<typeof OrganizationNoteData.createSchema>;

export type UpdateOrganizationNoteData = z.infer<typeof OrganizationNoteData.updateSchema>;
