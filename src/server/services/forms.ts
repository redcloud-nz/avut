/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { ConflictError } from "@/lib/errors";
import { FormInstance, type FormInstanceId } from "@/lib/schemas/form-instance";

import type { OrgServiceContext } from "./service-context";

/**
 * Save or update a form instance, ensuring it belongs to the current user and organization.
 *
 * @throws ConflictError if the instance belongs to a different user/organization, or if
 * `formKey` doesn't match an existing instance with the same ID.
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

    const updatedFormInstance = await ctx.prisma.formInstance.upsert({
        where: { id: formInstanceId },
        update: {
            formData: formData as object,
            formStatus: "Draft",
            updatedAt: new Date(),
        },
        create: {
            id: formInstanceId,
            formKey,
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            formData: formData as object,
            formStatus: "Draft",
        },
    });

    return FormInstance.fromRecord(updatedFormInstance);
}
