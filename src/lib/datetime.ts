/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { format, formatDistanceToNow } from "date-fns";

/**
 * Formats a date string for display to the user.
 * @param dateOrString The date or date string to format.
 * @returns The formatted date string.
 */
export function formatDate(dateOrString: string | Date): string {
    const date = new Date(dateOrString);
    return format(date, "yyyy-MM-dd");
}

export function formatDateTime(dateOrString: string | Date): string {
    const date = new Date(dateOrString);
    return format(date, "yyyy-MM-dd HH:mm");
}

export function formatRelativeDateTime(dateOrString: string | Date): string {
    const date = new Date(dateOrString);
    return formatDistanceToNow(date, { addSuffix: true });
}
