/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/** A skill's check frequency in months, as text: "None", "1 month", "N months". */
export function formatFrequency(months: number): string {
    if (months <= 0) return "None";
    return months === 1 ? "1 month" : `${months} months`;
}
