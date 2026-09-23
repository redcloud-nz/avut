/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type {
    FormInstanceItem as FormInstanceItemRecord,
    FormInstance as FormInstanceRecord,
} from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { OrganizationId } from "./organization";
import { UserId } from "./user";

export const FormInstanceId = {
    schema: zodNanoId16("FormInstanceId expected").brand<"FormInstanceId">(),

    create: () => FormInstanceId.schema.parse(nanoId16()),
} as const;

export type FormInstanceId = string & z.BRAND<"FormInstanceId">;

export const FormInstance = {
    schema: z.object({
        id: FormInstanceId.schema,
        formKey: z.string(),
        organizationId: OrganizationId.schema,
        userId: UserId.schema.nullable(),
        formData: z.record(z.string(), z.unknown()),
        formStatus: z.enum([
            "Draft",
            "Submitted",
            "Processed",
            "Pending",
            "Approved",
            "Rejected",
            "Acknowledged",
        ]),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
        deleted: z.boolean().default(false),
    }),

    fromRecord: (record: FormInstanceRecord) => {
        return FormInstance.schema.parse({
            ...record,
            createdAt: record?.createdAt?.toISOString(),
            updatedAt: record?.updatedAt?.toISOString(),
            deleted: false,
        });
    },
} as const;

export type FormInstance = z.infer<typeof FormInstance.schema>;

export const FormInstanceItemId = {
    schema: zodNanoId16("FormInstanceItemId expected").brand<"FormInstanceItemId">(),

    create: () => FormInstanceItemId.schema.parse(nanoId16()),
} as const;

export type FormInstanceItemId = string & z.BRAND<"FormInstanceItemId">;

export const FormInstanceItem = {
    schema: z.object({
        id: FormInstanceItemId.schema,
        formInstanceId: FormInstanceId.schema,
        parentItemId: FormInstanceItemId.schema.nullable(),
        collectionKey: z.string(),
        formData: z.record(z.string(), z.unknown()),
    }),

    fromRecord: (record: FormInstanceItemRecord) => {
        return FormInstanceItem.schema.parse({
            ...record,
        });
    },
} as const;

export type FormInstanceItem = z.infer<typeof FormInstanceItem.schema>;
