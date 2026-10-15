/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { TRPCError } from "@trpc/server";

import { logTrpcError } from "./log-error";

describe("logTrpcError", () => {
    afterEach(() => vi.restoreAllMocks());

    it("logs a client error as a single warning line", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const error = vi.spyOn(console, "error").mockImplementation(() => {});

        logTrpcError({
            error: new TRPCError({ code: "UNAUTHORIZED", message: "User is not authenticated." }),
            type: "query",
            path: "user.listMemberships",
        });

        expect(error).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledExactlyOnceWith(
            "[trpc] UNAUTHORIZED on query procedure at user.listMemberships: User is not authenticated.",
        );
    });

    it("logs a server error with the error object", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const failure = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "boom" });

        logTrpcError({ error: failure, type: "mutation", path: "notes.create" });

        expect(warn).not.toHaveBeenCalled();
        expect(error).toHaveBeenCalledExactlyOnceWith(
            "[trpc] Error on mutation procedure at notes.create:",
            failure,
        );
    });
});
