/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { authUrl, postSignInUrl, safeRedirectPath, signInUrl, signOutUrl } from "./auth-redirect";

describe("safeRedirectPath", () => {
    it("accepts same-origin relative paths", () => {
        expect(safeRedirectPath("/orgs/acme/admin")).toBe("/orgs/acme/admin");
        expect(safeRedirectPath("/orgs/acme/admin?tab=teams")).toBe("/orgs/acme/admin?tab=teams");
        expect(safeRedirectPath("/")).toBe("/");
    });

    it("rejects empty input", () => {
        expect(safeRedirectPath(undefined)).toBeNull();
        expect(safeRedirectPath(null)).toBeNull();
        expect(safeRedirectPath("")).toBeNull();
    });

    it("rejects absolute and protocol-relative URLs", () => {
        expect(safeRedirectPath("https://evil.example")).toBeNull();
        expect(safeRedirectPath("http://evil.example/orgs")).toBeNull();
        expect(safeRedirectPath("//evil.example")).toBeNull();
        expect(safeRedirectPath("/\\evil.example")).toBeNull();
        expect(safeRedirectPath("javascript:alert(1)")).toBeNull();
    });

    // URL parsing strips tab/CR/LF before it reads the path, so these resolve to
    // `//evil.example` despite starting with a single `/`.
    it("rejects paths that only become protocol-relative once parsed", () => {
        expect(safeRedirectPath("/\t/evil.example")).toBeNull();
        expect(safeRedirectPath("/\n/evil.example")).toBeNull();
        expect(safeRedirectPath("/\r/evil.example")).toBeNull();
        expect(safeRedirectPath("/x/..\\/evil.example")).toBeNull();
        expect(signOutUrl("/\t/evil.example")).toBe("/auth/sign-out");
        expect(signInUrl("/\n/evil.example")).toBe("/auth/sign-in");
    });

    // A browser resolves these to same-site paths. They're only dangerous if something
    // normalises them first, which would collapse them to `//evil.example`.
    it("never turns dot segments into a protocol-relative URL", () => {
        for (const value of ["/.//evil.example", "/a/..//evil.example", "/%2e//evil.example"]) {
            const result = safeRedirectPath(value);
            expect(result === null || !result.startsWith("//"), value).toBe(true);
            if (result !== null) {
                expect(new URL(result, "https://avut.nz").origin, value).toBe("https://avut.nz");
            }
        }
    });

    it("keeps the query string and hash of a safe path", () => {
        expect(safeRedirectPath("/docs/notes?a=1#top")).toBe("/docs/notes?a=1#top");
    });

    it("rejects values that are not paths", () => {
        expect(safeRedirectPath("orgs/acme")).toBeNull();
    });
});

describe("signInUrl", () => {
    it("encodes a valid return path", () => {
        expect(signInUrl("/orgs/acme/admin?tab=teams")).toBe(
            "/auth/sign-in?redirectTo=%2Forgs%2Facme%2Fadmin%3Ftab%3Dteams",
        );
    });

    it("falls back to the bare sign-in path for missing or unsafe input", () => {
        expect(signInUrl(undefined)).toBe("/auth/sign-in");
        expect(signInUrl(null)).toBe("/auth/sign-in");
        expect(signInUrl("//evil.example")).toBe("/auth/sign-in");
        expect(signInUrl("https://evil.example")).toBe("/auth/sign-in");
    });
});

describe("postSignInUrl", () => {
    it("encodes a valid return path", () => {
        expect(postSignInUrl("/modules")).toBe("/auth/post-sign-in?redirectTo=%2Fmodules");
    });

    it("falls back to the bare post-sign-in path for unsafe input", () => {
        expect(postSignInUrl("https://evil.example")).toBe("/auth/post-sign-in");
    });
});

describe("signOutUrl", () => {
    it("is the bare sign-out path without a return path", () => {
        expect(signOutUrl()).toBe("/auth/sign-out");
    });

    it("encodes a valid return path", () => {
        expect(signOutUrl("/invitations/abc")).toBe(
            "/auth/sign-out?redirectTo=%2Finvitations%2Fabc",
        );
    });

    it("drops an unsafe return path", () => {
        expect(signOutUrl("//evil.example")).toBe("/auth/sign-out");
    });
});

describe("authUrl", () => {
    it("returns the bare path when there is nothing to carry", () => {
        expect(authUrl("/auth/sign-up")).toBe("/auth/sign-up");
    });

    it("carries prefill values and a valid return path", () => {
        expect(
            authUrl("/auth/sign-up", {
                email: "a+b@example.com",
                name: "Ada Lovelace",
                returnTo: "/invitations/abc",
            }),
        ).toBe(
            "/auth/sign-up?email=a%2Bb%40example.com&name=Ada+Lovelace&redirectTo=%2Finvitations%2Fabc",
        );
    });

    it("drops an unsafe return path but keeps the rest", () => {
        expect(
            authUrl("/auth/sign-in", { email: "a@example.com", returnTo: "//evil.example" }),
        ).toBe("/auth/sign-in?email=a%40example.com");
    });
});
