/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

export const IssuedPPEItemData = {
    schema: z.object({
        id: z.string(),
        templateId: z.string(),
        itemName: z.string(),
        size: z.string(),
        serialNumber: z.string(),
    }),
} as const;

export type IssuedPPEItem = z.infer<typeof IssuedPPEItemData.schema>;

export const IssuePPEFormData = {
    schema: z.object({
        issuedItems: z
            .array(IssuedPPEItemData.schema)
            .nonempty("At least one item must be issued"),
        issuer: z.object({
            id: z.string(),
            name: z.string().nonempty("Issuer name is required"),
        }),
        recipient: z.object({
            id: z.string(),
            name: z.string().nonempty("Recipient name is required"),
        }),
        comments: z.string(),
        email: z.email("Invalid email address"),
    }),
} as const;

export type PPEIssueFormData = z.infer<typeof IssuePPEFormData.schema>;
