/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export type Result<T> = { data: T; error?: never } | { data?: never; error: Error };

export const Result = {
    /**
     * Construct an error result.
     * @param stringOrError The error message or Error object to wrap in an error result.
     * @returns An error result containing the provided error.
     */
    error<T>(stringOrError: string | Error): Result<T> {
        const error = typeof stringOrError === "string" ? new Error(stringOrError) : stringOrError;
        return { error };
    },

    /**
     * Flatten a nested result structure, returning the inner result if the outer result is successful, or the original error result if the outer result is an error.
     * @param result The nested result to flatten.
     * @returns The inner result if the outer result is successful, or the original error result if the outer result is an error.
     */
    flat<T>(result: Result<Result<T>>): Result<T> {
        if (Result.isSuccess(result)) {
            return result.data;
        } else {
            return result;
        }
    },

    /**
     * Map a function that returns a result over a successful result, flattening the result structure.
     * @param result The result to map over.
     * @param fn The function to apply to the result's data.
     * @returns A new result with the function applied if successful, or the original error result.
     */
    flatMap<T, U>(result: Result<T>, fn: (data: T) => Result<U>): Result<U> {
        if (Result.isSuccess(result)) {
            return fn(result.data);
        } else {
            return result;
        }
    },

    /**
     * Check if a result is an error.
     * @param result The result to check.
     * @returns True if the result is an error, false otherwise.
     */
    isError<T>(result: Result<T>): result is { data?: never; error: Error } {
        return "error" in result;
    },

    /**
     * Check if a result is a success.
     * @param result The result to check.
     * @returns True if the result is a success, false otherwise.
     */
    isSuccess<T>(result: Result<T>): result is { data: T; error?: never } {
        return "data" in result;
    },

    /**
     * Map a function over a successful result.
     * @param result The result to map over.
     * @param fn The function to apply to the result's data.
     * @returns A new result with the function applied if successful, or the original error result.
     */
    map: function <T, U>(result: Result<T>, fn: (data: T) => U): Result<U> {
        if (Result.isSuccess(result)) {
            return { data: fn(result.data) };
        } else {
            return result;
        }
    },

    async runAsyncCatching<T>(fn: () => Promise<T>): Promise<Result<T>> {
        try {
            const data = await fn();
            return { data };
        } catch (error) {
            return { error: error instanceof Error ? error : new Error(String(error)) };
        }
    },

    /**
     * Run a function that may throw an error and capture its result in a Result object.
     * @param fn The function to run, which may throw an error.
     * @returns A Result object containing either the data returned by the function or the error thrown.
     */
    runCatching<T>(fn: () => T): Result<T> {
        try {
            const data = fn();
            return { data };
        } catch (error) {
            return { error: error instanceof Error ? error : new Error(String(error)) };
        }
    },

    /**
     * Construct a successful result.
     * @param data The data to wrap in a successful result.
     * @returns A successful result containing the provided data.
     */
    success<T>(data: T): Result<T> {
        return { data };
    },
};
