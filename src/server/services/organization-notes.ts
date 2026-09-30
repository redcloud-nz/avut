/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { diffObject, type DiffChange } from "@/lib/diff";
import { NotFoundError } from "@/lib/errors";
import {
    OrganizationNoteData,
    OrganizationNoteId,
    type CreateOrganizationNoteData,
    type UpdateOrganizationNoteData,
} from "@/lib/schemas/organization-note";

import type { OrgServiceContext } from "./service-context";

/**
 * A note as the list shows it: no `content`, plus the author's id and name, or `null` once the
 * author's account has been purged.
 */
export interface OrganizationNoteListItem {
    id: OrganizationNoteId;
    title: string;
    createdAt: string;
    updatedAt: string;
    author: { id: string; name: string } | null;
}

/** List the organization's notes, most recently updated first. */
export async function list(ctx: OrgServiceContext): Promise<OrganizationNoteListItem[]> {
    const notes = await ctx.prisma.organizationNote.findMany({
        where: { organizationId: ctx.organizationId },
        select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            author: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
    });

    return notes.map((note) => ({
        id: OrganizationNoteId.schema.parse(note.id),
        title: note.title,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
        author: note.author ?? null,
    }));
}

/**
 * Fetch a note by ID, or `null` if it does not exist within the organization. Callers that need
 * the note to exist should use `requireById` instead.
 */
export async function getById(
    ctx: OrgServiceContext,
    noteId: OrganizationNoteId,
): Promise<OrganizationNoteData | null> {
    const note = await ctx.prisma.organizationNote.findUnique({
        where: { id: noteId, organizationId: ctx.organizationId },
    });

    return note ? OrganizationNoteData.fromRecord(note) : null;
}

/**
 * Fetch a note by ID and ensure it belongs to the organization.
 * @throws NotFoundError if the note does not exist within the organization.
 */
export async function requireById(
    ctx: OrgServiceContext,
    noteId: OrganizationNoteId,
): Promise<OrganizationNoteData> {
    const note = await getById(ctx, noteId);

    if (!note) {
        throw new NotFoundError(`OrganizationNote(id=${noteId}) not found.`);
    }

    return note;
}

/**
 * Create a note authored by the calling user. The body is never copied into the log: a
 * non-empty body is recorded as a bare `obj_mask` marker.
 */
export async function create(
    ctx: OrgServiceContext,
    input: CreateOrganizationNoteData,
): Promise<OrganizationNoteData> {
    const id = OrganizationNoteId.create();
    const content = input.content ?? "";

    const changes: DiffChange[] = diffObject({}, { title: input.title });
    if (content !== "") changes.push({ type: "obj_mask", path: ["content"] });

    const [created] = await ctx.prisma.$transaction([
        ctx.prisma.organizationNote.create({
            data: {
                id,
                organizationId: ctx.organizationId,
                authorId: ctx.userId,
                title: input.title,
                content,
            },
        }),
        ctx.logEvent({ action: "Create", objectType: "OrganizationNote", objectId: id, changes }),
    ]);

    return OrganizationNoteData.fromRecord(created);
}

/**
 * Update a note's title and/or body. No-op, returning the existing note unchanged, if neither
 * differs. The log carries the title diff and, when the body changed, only an `obj_mask` marker.
 * Doesn't check who may edit the note; the caller does.
 * @throws NotFoundError if the note does not exist within the organization.
 */
export async function update(
    ctx: OrgServiceContext,
    noteId: OrganizationNoteId,
    input: UpdateOrganizationNoteData,
): Promise<OrganizationNoteData> {
    const existing = await requireById(ctx, noteId);

    const changes: DiffChange[] =
        input.title === undefined
            ? []
            : diffObject({ title: existing.title }, { title: input.title });
    if (input.content !== undefined && input.content !== existing.content) {
        changes.push({ type: "obj_mask", path: ["content"] });
    }

    if (changes.length === 0) return existing;

    const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.organizationNote.update({
            where: { id: noteId, organizationId: ctx.organizationId },
            data: { title: input.title, content: input.content },
        }),
        ctx.logEvent({
            action: "Update",
            objectType: "OrganizationNote",
            objectId: noteId,
            changes,
        }),
    ]);

    return OrganizationNoteData.fromRecord(updated);
}

/**
 * Permanently delete a note. Notes aren't in the Rubbish bin, so this is a hard delete; the log
 * entry's description keeps the title.
 * Doesn't check who may delete the note; the caller does.
 * @throws NotFoundError if the note does not exist within the organization.
 */
export async function remove(
    ctx: OrgServiceContext,
    noteId: OrganizationNoteId,
): Promise<OrganizationNoteData> {
    const existing = await requireById(ctx, noteId);

    await ctx.prisma.$transaction([
        ctx.prisma.organizationNote.delete({
            where: { id: noteId, organizationId: ctx.organizationId },
        }),
        ctx.logEvent({
            action: "Delete",
            objectType: "OrganizationNote",
            objectId: noteId,
            description: existing.title,
        }),
    ]);

    return existing;
}
