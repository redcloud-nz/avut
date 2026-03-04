/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

export const D4HEquipmentLocation = {
    schema: z.object({
        id: z.number(),
        resourceType: z.literal("EquipmentLocation"),
    }),
};

export type D4HEquipmentLocation = z.infer<typeof D4HEquipmentLocation.schema>;
