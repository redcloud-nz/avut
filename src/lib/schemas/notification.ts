/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

export const Notification = {
    schema: z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        path: z.string(),
        date: z.date(),
    }),
} as const;

export type Notification = z.infer<typeof Notification.schema>;
