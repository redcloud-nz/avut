/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

/** A note's title, shared by organization and user notes: required, trimmed, 1–200 chars. */
export const NoteTitle = {
    schema: z.string().trim().min(1, "Title is required").max(200),
} as const;

/** A note's markdown body. The cap is only a sanity limit, not a design constraint. */
export const NoteContent = {
    schema: z.string().max(100_000),
} as const;
