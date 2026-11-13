/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { ConflictError } from "@/lib/errors";
import { FormInstance, type FormInstanceId } from "@/lib/schemas/form-instance";

import type { OrgServiceContext } from "./service-context";

/**
 * Save or update a draft form instance, ensuring it belongs to the current user and organization.
 *
 * Only a draft can be saved: once submitted, an instance is read-only. The update is conditional
 * on the instance still being a draft, so a status write that lands between the read and the
 * write isn't reverted.
 *
 * @throws ConflictError if the instance belongs to a different user/organization, if `formKey`
 * doesn't match an existing instance with the same ID, or if the existing instance isn't a draft.
 */
export async function saveInstance(
    ctx: OrgServiceContext,
    {
        formInstanceId,
        formKey,
        formData,
    }: { formInstanceId: FormInstanceId; formKey: string; formData: Record<string, unknown> },
): Promise<FormInstance> {
    const existing = await ctx.prisma.formInstance.findUnique({
        where: {
            id: formInstanceId,
        },
    });
    if (
        existing &&
        (existing.organizationId !== ctx.organizationId || existing.userId !== ctx.userId)
    ) {
        throw new ConflictError(
            `FormInstance(${formInstanceId}) belongs to a different user or organisation`,
        );
    }
    if (existing && existing.formKey !== formKey) {
        throw new ConflictError(
            `FormInstance(${formInstanceId}) formKey mismatch: expected ${existing.formKey}, got ${formKey}`,
        );
    }

    if (existing && existing.formStatus !== "Draft") {
        throw new ConflictError(
            `FormInstance(${formInstanceId}) is ${existing.formStatus}, not a draft, and can't be changed`,
        );
    }

    if (!existing) {
        const created = await ctx.prisma.formInstance.create({
            data: {
                id: formInstanceId,
                formKey,
                organizationId: ctx.organizationId,
                userId: ctx.userId,
                formData: formData as object,
                formStatus: "Draft",
            },
        });
        return FormInstance.fromRecord(created);
    }

    const { count } = await ctx.prisma.formInstance.updateMany({
        where: { id: formInstanceId, formStatus: "Draft" },
        data: {
            formData: formData as object,
            updatedAt: new Date(),
        },
    });
    if (count === 0) {
        throw new ConflictError(
            `FormInstance(${formInstanceId}) is no longer a draft and can't be changed`,
        );
    }

    const updatedFormInstance = await ctx.prisma.formInstance.findUniqueOrThrow({
        where: { id: formInstanceId },
    });

    return FormInstance.fromRecord(updatedFormInstance);
}
