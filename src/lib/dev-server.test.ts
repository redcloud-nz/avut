/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authCookiePrefix, withDevServerPort } from "./dev-server";

describe("dev-server", () => {
    beforeEach(() => {
        vi.stubEnv("NODE_ENV", "development");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("withDevServerPort", () => {
        it("swaps in the dev server's port on a localhost URL", () => {
            vi.stubEnv("PORT", "3103");
            expect(withDevServerPort("http://localhost:3000")).toBe("http://localhost:3103");
        });

        it("leaves a real host alone", () => {
            vi.stubEnv("PORT", "3103");
            expect(withDevServerPort("https://avut.example.com")).toBe("https://avut.example.com");
        });

        it("changes nothing outside development", () => {
            vi.stubEnv("NODE_ENV", "production");
            vi.stubEnv("PORT", "3103");
            expect(withDevServerPort("http://localhost:3000")).toBe("http://localhost:3000");
        });

        it("changes nothing when the port is unknown", () => {
            expect(withDevServerPort("http://localhost:3000")).toBe("http://localhost:3000");
        });
    });

    describe("authCookiePrefix", () => {
        it("keeps the default on 3000", () => {
            vi.stubEnv("PORT", "3000");
            expect(authCookiePrefix()).toBeUndefined();
        });

        it("is per-port on any other dev server", () => {
            vi.stubEnv("PORT", "3101");
            expect(authCookiePrefix()).toBe("better-auth-3101");
        });

        it("keeps the default outside development", () => {
            vi.stubEnv("NODE_ENV", "production");
            vi.stubEnv("PORT", "3101");
            expect(authCookiePrefix()).toBeUndefined();
        });
    });
});
