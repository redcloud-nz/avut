/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 *  Pure enforcement of the link-time invariants in docs/specs/d4h-linking.md §4.
 *  Unit-tested in `d4h-link-invariants.test.ts`.
 */

import { TRPCError } from "@trpc/server";

/** The existing `Organization_D4H` row, reduced to what the invariants read. */
export type OrgD4HState = {
    serverCode: string;
    d4hOrganisationId: number | null;
} | null;

export type AssertD4HLinkInput = {
    orgD4H: OrgD4HState;
    tokenServerCode: string;
    /** The D4H team's owning organisation id, or `null` if the team is org-less. */
    owningOrgId: number | null;
};

export type D4HLinkAction =
    | { kind: "create-org-linked"; d4hOrganisationId: number }
    | { kind: "create-org-less" }
    | { kind: "reuse" };

/**
 * Resolves what linking this D4H team implies for the org, or throws a
 * `TRPCError` describing why it is not allowed.
 */
export function assertD4HLinkAllowed(input: AssertD4HLinkInput): D4HLinkAction {
    const { orgD4H, tokenServerCode, owningOrgId } = input;

    // §4.1 — server consistency.
    if (orgD4H && orgD4H.serverCode !== tokenServerCode) {
        throw new TRPCError({
            code: "CONFLICT",
            message: `This organization's D4H link uses the "${orgD4H.serverCode}" server; that access token is for the "${tokenServerCode}" server.`,
        });
    }

    // §4.3 — the D4H team belongs to an organisation.
    if (owningOrgId !== null) {
        if (!orgD4H) {
            return { kind: "create-org-linked", d4hOrganisationId: owningOrgId };
        }
        if (orgD4H.d4hOrganisationId === null) {
            throw new TRPCError({
                code: "CONFLICT",
                message:
                    "This organization is linked to an org-less D4H team, which blocks all other D4H links. Unlink it first.",
            });
        }
        if (orgD4H.d4hOrganisationId !== owningOrgId) {
            throw new TRPCError({
                code: "CONFLICT",
                message: `This organization is linked to D4H organisation ${orgD4H.d4hOrganisationId}; that team belongs to ${owningOrgId}.`,
            });
        }
        return { kind: "reuse" };
    }

    // §4.4 — the D4H team is org-less.
    if (!orgD4H) {
        return { kind: "create-org-less" };
    }
    if (orgD4H.d4hOrganisationId !== null) {
        throw new TRPCError({
            code: "CONFLICT",
            message: `This organization is linked to D4H organisation ${orgD4H.d4hOrganisationId}; an org-less D4H team cannot also be linked.`,
        });
    }
    throw new TRPCError({
        code: "CONFLICT",
        message: "This organization already has an org-less D4H team linked; only one is allowed.",
    });
}
