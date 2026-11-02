/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/** A rule's look-ahead in words, e.g. "Next 24 hours". Shared by the rules list and the rule page. */
export function describeWindow(lookAheadHours: number): string {
    return lookAheadHours === 1 ? "Next hour" : `Next ${lookAheadHours} hours`;
}
