/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * The closed vocabulary of multi-entry operations — the `operationKey` on a
 * `LogBatch`.
 *
 * Mirrors `modules.ts`: one source of truth for the keys and their human
 * labels, so a call site cannot invent a key.
 *
 * A batch correlates *independently meaningful events* — ones that would each
 * belong, on their own, on their own entity's timeline. It does not exist to
 * group the row-writes of a single event. A D4H import creating a Person earns
 * an entry on that person's page and so is a batch; a reorder writing a
 * sequence integer across five rows is one event whose N-ness is an
 * implementation detail, and is one entry.
 */
export const Operations = {
    "d4h-team-import": { label: "D4H team import" },
    "d4h-team-link": { label: "D4H team link" },
    "d4h-team-sync": { label: "D4H team sync" },
} as const;

/** Identifier for a named multi-entry operation. */
export type OperationKey = keyof typeof Operations;
