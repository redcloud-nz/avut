/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { TRPCClientError } from "@trpc/client";

describe("trpcClient on the server", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // A call here would go out without the request's cookies (#459), so it must fail without fetching.
    it("fails a call at once, without fetching", async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
        // The link is chosen when the module loads, from whether `window` exists.
        vi.stubGlobal("window", undefined);
        vi.resetModules();

        const { trpcClient } = await import("./client");
        const call = trpcClient.user.getSession.query();

        await expect(call).rejects.toBeInstanceOf(TRPCClientError);
        await expect(call).rejects.toThrow(/user\.getSession was called during the server render/);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
