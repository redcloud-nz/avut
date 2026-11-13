/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { ConflictError, NotFoundError } from "@/lib/errors";
import {
    FormInstance,
    type FormInstanceId,
    type FormInstancePage,
} from "@/lib/schemas/form-instance";

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

/**
 * Fetch one of the caller's own form instances in the current organization, whatever its status.
 *
 * @throws NotFoundError if the instance doesn't exist, belongs to another user or organization, or
 * (when `formKey` is given) is a different form.
 */
export async function requireInstanceById(
    ctx: OrgServiceContext,
    { formInstanceId, formKey }: { formInstanceId: FormInstanceId; formKey?: string },
): Promise<FormInstance> {
    const record = await ctx.prisma.formInstance.findUnique({
        where: {
            id: formInstanceId,
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            ...(formKey === undefined ? {} : { formKey }),
        },
    });

    if (!record) {
        throw new NotFoundError(`FormInstance(${formInstanceId}) not found`);
    }

    return FormInstance.fromRecord(record);
}

/**
 * One page of the caller's submitted instances of a form in the current organization, newest
 * first. "Submitted" is any status other than `Draft`, and the submitted time is `updatedAt`
 * (a non-draft is read-only, so nothing moves it afterwards).
 *
 * @param cursor - The id of the last instance on the previous page; omit for the first page.
 */
export async function listSubmittedInstances(
    ctx: OrgServiceContext,
    { formKey, cursor, limit }: { formKey: string; cursor?: FormInstanceId; limit: number },
): Promise<FormInstancePage> {
    const records = await ctx.prisma.formInstance.findMany({
        where: {
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            formKey,
            formStatus: { not: "Draft" },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
        take: limit + 1,
    });

    const page = records.slice(0, limit).map(FormInstance.fromRecord);

    return {
        items: page,
        nextCursor: records.length > limit ? page[page.length - 1].id : null,
    };
}
