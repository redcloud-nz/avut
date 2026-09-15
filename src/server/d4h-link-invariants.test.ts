/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { assertD4HLinkAllowed, OrgD4HState } from "./d4h-link-invariants";

const orgLinked = (id: number, serverCode = "us"): OrgD4HState => ({
    serverCode,
    d4hOrganisationId: id,
});
const orgLess = (serverCode = "us"): OrgD4HState => ({ serverCode, d4hOrganisationId: null });

describe("assertD4HLinkAllowed — §4.1 server consistency", () => {
    it("rejects a token on a different server than the existing link", () => {
        expect(() =>
            assertD4HLinkAllowed({
                orgD4H: orgLinked(10, "eu"),
                tokenServerCode: "us",
                owningOrgId: 10,
            }),
        ).toThrow(/"eu" server.*"us" server/);
    });
});

describe("assertD4HLinkAllowed — §4.3 D4H team has an organisation", () => {
    it("(a) no Organization_D4H → create-org-linked", () => {
        expect(
            assertD4HLinkAllowed({ orgD4H: null, tokenServerCode: "us", owningOrgId: 7 }),
        ).toEqual({ kind: "create-org-linked", d4hOrganisationId: 7 });
    });

    it("(b) same org → reuse", () => {
        expect(
            assertD4HLinkAllowed({ orgD4H: orgLinked(7), tokenServerCode: "us", owningOrgId: 7 }),
        ).toEqual({ kind: "reuse" });
    });

    it("(b) different org → reject", () => {
        expect(() =>
            assertD4HLinkAllowed({ orgD4H: orgLinked(7), tokenServerCode: "us", owningOrgId: 9 }),
        ).toThrow(/linked to D4H organisation 7; that team belongs to 9/);
    });

    it("(c) org-less link present → reject", () => {
        expect(() =>
            assertD4HLinkAllowed({ orgD4H: orgLess(), tokenServerCode: "us", owningOrgId: 9 }),
        ).toThrow(/org-less D4H team, which blocks all other D4H links/);
    });
});

describe("assertD4HLinkAllowed — §4.4 D4H team is org-less", () => {
    it("(a) no Organization_D4H → create-org-less", () => {
        expect(
            assertD4HLinkAllowed({ orgD4H: null, tokenServerCode: "us", owningOrgId: null }),
        ).toEqual({ kind: "create-org-less" });
    });

    it("(b) org-linked → reject", () => {
        expect(() =>
            assertD4HLinkAllowed({
                orgD4H: orgLinked(7),
                tokenServerCode: "us",
                owningOrgId: null,
            }),
        ).toThrow(/linked to D4H organisation 7; an org-less D4H team cannot also be linked/);
    });

    it("(c) already has an org-less team → reject", () => {
        expect(() =>
            assertD4HLinkAllowed({ orgD4H: orgLess(), tokenServerCode: "us", owningOrgId: null }),
        ).toThrow(/already has an org-less D4H team linked/);
    });
});
