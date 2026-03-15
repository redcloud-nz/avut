/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { I3TemplateId } from "./i3-template";
import { I3TemplateVariantId } from "./i3-template-variant";

export const IssuedItem = {
    schema: z.object({
        template: z.object(
            {
                id: I3TemplateId.schema,
                name: z.string(),
            },
            "Template is required",
        ),
        variant: z
            .object({
                id: I3TemplateVariantId.schema,
                name: z.string(),
            })
            .nullable(),
        serialNumber: z.string().nullable(),
    }),
} as const;

export type IssuedItem = z.infer<typeof IssuedItem.schema>;

export const IssueItemsFormData = {
    schema: z.object({
        recipient: z.object({
            id: z.number(),
            name: z.string(),
        }),
        items: z.array(IssuedItem.schema),
        comments: z.string(),
    }),
} as const;

export type IssueItemsFormData = z.infer<typeof IssueItemsFormData.schema>;

export type IssueItemsFormInputData = z.input<typeof IssueItemsFormData.schema>;
