/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

export const D4HEquipmentItem = {
    schema: z.object({
        id: z.number(),
        ref: z.string(),
        status: z.string(),
        serial: z.string().nullable(),
        // idMarks: z.string().nullable(),

        owner: z.object({
            resourceType: z.literal("Team"),
            id: z.number(),
        }),
        category: z.object({
            resourceType: z.literal("EquipmentCategory"),
            id: z.number(),
        }),

        kind: z.object({
            resourceType: z.literal("EquipmentKind"),
            id: z.number(),
            title: z.string(),
        }),
        brand: z.object({
            resourceType: z.literal("EquipmentBrand"),
            id: z.number().nullable(),
            title: z.string().optional(),
        }),
        model: z
            .object({
                resourceType: z.literal("EquipmentModel"),
                id: z.number().nullable(),
                title: z.string().optional(),
            })
            .nullable(),
        notes: z.string(),
        parents: z.array(
            z.object({
                id: z.number(),
                ref: z.string(),
            }),
        ),
        dateExpires: z.string().nullable(),
        dateFirstUse: z.string().nullable(),
        dateManufactured: z.string().nullable(),
        datePurchased: z.string().nullable(),
        dateRetired: z.string().nullable(),
        dateWarranty: z.string().nullable(),
    }),
} as const;

export type D4HEquipmentItem = z.infer<typeof D4HEquipmentItem.schema>;

/**
 * The `status` values D4H's equipment PATCH accepts. A GET can also return `RETIRED`, which only
 * D4H's web app can set.
 */
export const D4HEquipmentStatus = {
    schema: z.enum(["OPERATIONAL", "UNSERVICEABLE", "LOST", "WISHLIST", "INACTIVE"] as const),

    /**
     * The label D4H's web app shows for a status (`INACTIVE` is "Non Operational"). Takes any
     * string, since a GET can return `RETIRED` or a value AVUT doesn't know, which falls back to
     * the raw value.
     */
    label: (status: string): string => STATUS_LABELS[status] ?? status,
} as const;

const STATUS_LABELS: Record<string, string> = {
    OPERATIONAL: "Operational",
    UNSERVICEABLE: "Unserviceable",
    LOST: "Lost",
    WISHLIST: "Wishlist",
    INACTIVE: "Non Operational",
    RETIRED: "Retired",
};

export type D4HEquipmentStatus = z.infer<typeof D4HEquipmentStatus.schema>;

/**
 * Who or where holds an item (`Member` for a person), kept to its type and id. D4H expands a
 * holding member to their full record (address, phones, emergency contacts, iCal secret), which
 * must never reach the client; `z.object` strips every other key on parse. Never widen it: resolve
 * a holder's name from the team's member list instead.
 *
 * Some live items carry a `location` without an `id` (seen in a team-wide list, 2026-10-24), so
 * `id` is optional: one such item mustn't fail the whole list. Treat it as unheld.
 */
const D4HEquipmentItemLocation = z
    .object({ resourceType: z.string(), id: z.number().nullish() })
    .nullable()
    .optional();

/**
 * An equipment item as the list GET returns it, with its `location` narrowed as on
 * `D4HEquipmentItemDetail`.
 */
export const D4HEquipmentListItem = {
    schema: D4HEquipmentItem.schema.extend({
        /** Who or where holds the item (`Member` for a person). Only the type and id survive. */
        location: D4HEquipmentItemLocation,
    }),
} as const;

export type D4HEquipmentListItem = z.infer<typeof D4HEquipmentListItem.schema>;

/**
 * An equipment item as the single-item GET returns it. The response is typed `unknown` in the
 * generated schema, so the field names come from its `@example` and a live probe (2026-10-22).
 *
 * `location` keeps only `resourceType` and `id`. D4H expands it to the holding member's full
 * record (address, phones, emergency contacts, iCal secret), which must never reach the client;
 * `z.object` strips every other key on parse. Never widen it: resolve a holder's name from the
 * team's member list instead.
 */
export const D4HEquipmentItemDetail = {
    schema: D4HEquipmentItem.schema.extend({
        isCritical: z.boolean(),
        isMonitor: z.boolean(),
        barcode: z.string().nullable(),
        retiredReason: z
            .object({
                id: z.number().nullable(),
                resourceType: z.literal("EquipmentRetiredReason"),
            })
            .nullable()
            .optional(),
        /** Who or where holds the item (`Member` for a person). Only the type and id survive. */
        location: D4HEquipmentItemLocation,
    }),
} as const;

export type D4HEquipmentItemDetail = z.infer<typeof D4HEquipmentItemDetail.schema>;

/**
 * The fields AVUT sends in an equipment PATCH. D4H rejects anything else with a 400. Clearing a
 * barcode sends `""`.
 */
export const D4HEquipmentItemUpdate = {
    schema: z.object({
        status: D4HEquipmentStatus.schema.optional(),
        isCritical: z.boolean().optional(),
        isMonitor: z.boolean().optional(),
        barcode: z.string().optional(),
        notes: z.string().optional(),
        updateNotes: z.string().optional(),
    }),
} as const;

export type D4HEquipmentItemUpdate = z.infer<typeof D4HEquipmentItemUpdate.schema>;
