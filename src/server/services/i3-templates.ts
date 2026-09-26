/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { I3Template, type I3TemplateId } from "@/lib/schemas/i3-template";

import type { OrgServiceContext } from "./service-context";

/**
 * Fetch an I3 Template by ID, or `null` if it does not exist within the organization. Callers
 * that need the template to exist should use `requireById` instead.
 */
export async function getById(
    ctx: OrgServiceContext,
    templateId: I3TemplateId,
): Promise<I3Template | null> {
    const template = await ctx.prisma.i3Template.findUnique({
        where: { id: templateId, organizationId: ctx.organizationId },
        include: { d4h: true },
    });

    if (!template) return null;

    return I3Template.fromRecord(template);
}

/**
 * Fetch an I3 Template by ID and ensure it belongs to the organization.
 * @throws NotFoundError if the template does not exist within the organization.
 */
export async function requireById(
    ctx: OrgServiceContext,
    templateId: I3TemplateId,
): Promise<I3Template> {
    const template = await getById(ctx, templateId);

    if (!template) {
        throw new NotFoundError(`I3Template(id=${templateId}) not found.`);
    }

    return template;
}

/**
 * Soft-delete an I3 Template (reversible via `restoreFromTrash`). No-op, returning the existing
 * record unchanged, if the template is already `Deleted`.
 *
 * I3Template has no archive concept (#295) — only delete/restore-from-trash.
 * `I3TemplateVariant` rows are deliberately left untouched (out of scope for #295; they have no
 * `RecordStatus` column of their own).
 * @throws NotFoundError if the template is not found in the organization.
 */
export async function deleteRecord(
    ctx: OrgServiceContext,
    templateId: I3TemplateId,
): Promise<I3Template> {
    const existing = await requireById(ctx, templateId);

    if (existing.status === "Deleted") {
        return existing;
    }

    await ctx.prisma.$transaction([
        ctx.prisma.i3Template.update({
            where: { id: templateId, organizationId: ctx.organizationId },
            data: { status: "Deleted" },
        }),
        ctx.logEvent({ action: "Delete", objectType: "I3Template", objectId: templateId }),
    ]);

    return await requireById(ctx, templateId);
}

/**
 * Restore a `Deleted` I3 Template back to `Active`. No-op, returning the existing record
 * unchanged, if the template is already `Active`.
 * @throws NotFoundError if the template is not found in the organization.
 * @throws ValidationError if the template is not `Deleted` (there is no archive state to guard
 * against here, but a future non-`Active`/`Deleted` status should still be rejected explicitly).
 */
export async function restoreFromTrash(
    ctx: OrgServiceContext,
    templateId: I3TemplateId,
): Promise<I3Template> {
    const existing = await requireById(ctx, templateId);

    if (existing.status === "Active") {
        return existing;
    }

    if (existing.status !== "Deleted") {
        throw new ValidationError(
            `I3Template(id=${templateId}) has status ${existing.status}; only a Deleted template can be restored from rubbish.`,
        );
    }

    await ctx.prisma.$transaction([
        ctx.prisma.i3Template.update({
            where: { id: templateId, organizationId: ctx.organizationId },
            data: { status: "Active" },
        }),
        ctx.logEvent({ action: "Restore", objectType: "I3Template", objectId: templateId }),
    ]);

    return await requireById(ctx, templateId);
}
