/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

/** One D4H equipment item being returned, with the labels the notes, task and email show. */
export const I3ReturnedItem = {
    schema: z.object({
        itemId: z.number(),
        ref: z.string(),
        kindTitle: z.string(),
    }),
} as const;

export type I3ReturnedItem = z.infer<typeof I3ReturnedItem.schema>;

/** A returned item as the emails list it: the form's item plus its brand, model and serial from D4H. */
export type I3ReturnedItemSummary = I3ReturnedItem & {
    brandTitle?: string;
    modelTitle?: string;
    serial?: string | null;
};

export const I3ReturnItemsFormData = {
    schema: z.object({
        /** The D4H member returning the items ("Returned by" in the UI). */
        recipient: z
            .object({
                id: z.number(),
                teamId: z.number(),
                name: z.string(),
            })
            .refine((recipient) => recipient.id > 0, "Returned by is required"),
        // min(1) rather than nonempty(): same check, but typed as an array, so a draft (or a
        // change of "Returned by") can hold no items without a cast.
        items: z.array(I3ReturnedItem.schema).min(1, "At least one item must be returned"),
        comments: z.string(),
    }),
} as const;

export type I3ReturnItemsFormData = z.infer<typeof I3ReturnItemsFormData.schema>;

export type I3ReturnItemsFormInputData = z.input<typeof I3ReturnItemsFormData.schema>;
