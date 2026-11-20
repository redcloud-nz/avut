/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { createLinkToken, hashLinkToken } from "./link-token";

describe("createLinkToken", () => {
    it("returns a different token on each call", () => {
        const a = createLinkToken();
        const b = createLinkToken();

        expect(a.token).not.toBe(b.token);
        expect(a.hash).not.toBe(b.hash);
    });

    it("returns a URL-safe token of 32 random bytes", () => {
        const { token } = createLinkToken();

        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(encodeURIComponent(token)).toBe(token);
        expect(Buffer.from(token, "base64url")).toHaveLength(32);
    });

    it("returns the hash of its own token", () => {
        const { token, hash } = createLinkToken();

        expect(hash).toBe(hashLinkToken(token));
    });
});

describe("hashLinkToken", () => {
    it("is stable for the same token", () => {
        expect(hashLinkToken("abc")).toBe(hashLinkToken("abc"));
    });

    it("is the sha256 hex digest", () => {
        expect(hashLinkToken("abc")).toBe(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        );
    });
});
