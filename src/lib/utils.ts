/*
 *  Copyright (c) 2024 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Get a user's initials.
 * @param name The user's full name
 * @returns The user's initials (first letter of first and last name).
 */
export function getUserInitials(name: string | null): string {
    if (!name) return "";
    const parts = name.split(" ");
    switch (parts.length) {
        case 0:
            return "";
        case 1:
            // Name has only one part. Use just the first letter.
            return parts[0].charAt(0).toUpperCase();
        case 2:
            // Name has only two parts
            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        default:
            // Name has three or more parts. We assume the middle ones to be middle names or Tuessenvoegsel
            return (
                parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
            ).toUpperCase();
    }
}
