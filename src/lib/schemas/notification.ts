/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

const notificationSchema = z.object({
    id: z.string(),
    userId: z.string(),
});
