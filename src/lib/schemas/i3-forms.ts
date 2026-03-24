/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { I3TemplateId } from "./i3-template";
import { I3TemplateVariantId } from "./i3-template-variant";

export const I3IssuedItem = {
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

export type I3IssuedItem = z.infer<typeof I3IssuedItem.schema>;

export type I3IssuedItemInput = z.input<typeof I3IssuedItem.schema>;

export const I3IssueItemsFormData = {
    schema: z.object({
        recipient: z
            .object({
                id: z.number(),
                teamId: z.number(),
                name: z.string(),
            })
            .refine((recipient) => recipient.id > 0, "Recipient is required"),
        items: z.array(I3IssuedItem.schema).nonempty("At least one item must be issued"),
        comments: z.string(),
    }),
} as const;

export type I3IssueItemsFormData = z.infer<typeof I3IssueItemsFormData.schema>;

export type I3IssueItemsFormInputData = z.input<typeof I3IssueItemsFormData.schema>;
