/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export type Result<T, E = any> =
    | { data: T; error?: never }
    | { data?: never; error: E };

export function isError<T, E>(
    result: Result<T, E>,
): result is { data?: never; error: E } {
    return "error" in result;
}

export function isSuccess<T, E>(
    result: Result<T, E>,
): result is { data: T; error?: never } {
    return "data" in result;
}

export const Result = {
    map: function <T, E, U>(
        result: Result<T, E>,
        fn: (data: T) => U,
    ): Result<U, E> {
        if (isSuccess(result)) {
            return { data: fn(result.data) };
        } else {
            return result;
        }
    },
};
