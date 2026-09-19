/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { invitationsRouter } from "./invitations-router";

describe("invitations.getLanding", () => {
    // Dataset (all invited to the same organization by the same inviter):
    //   pending      → newcomer@example.com, no account, linked to a Person
    //   pendingKnown → existing@example.com, who has an account
    //   expired / accepted / rejected / canceled → one each, for existing@example.com
    const T = {
        org: OrganizationId.create(),
        inviter: UserId.create(),
        existing: UserId.create(),
        person: PersonId.create(),
        pending: InvitationId.create(),
        pendingKnown: InvitationId.create(),
        expired: InvitationId.create(),
        accepted: InvitationId.create(),
        rejected: InvitationId.create(),
        canceled: InvitationId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Mountain Rescue", slug: "mountain", createdAt: new Date() },
        });
        await db.user.create({
            data: {
                id: T.inviter,
                name: "Alex Admin",
                email: "admin@example.com",
                emailVerified: true,
            },
        });
        await db.user.create({
            data: {
                id: T.existing,
                name: "Existing",
                email: "existing@example.com",
                emailVerified: true,
            },
        });
        await db.person.create({
            data: {
                id: T.person,
                organizationId: T.org,
                name: "Nia Newcomer",
                email: "newcomer@example.com",
                status: "Active",
                tags: [],
                properties: {},
            },
        });

        const base = { organizationId: T.org, inviterId: T.inviter, role: "member" };
        const future = new Date("2099-01-01T00:00:00Z");
        const invite = (id: string, email: string, status: string, expiresAt = future) =>
            db.organizationInvitation.create({ data: { ...base, id, email, status, expiresAt } });

        await db.organizationInvitation.create({
            data: {
                ...base,
                id: T.pending,
                email: "newcomer@example.com",
                status: "pending",
                expiresAt: future,
                personId: T.person,
            },
        });
        await invite(T.pendingKnown, "existing@example.com", "pending");
        await invite(T.expired, "existing@example.com", "pending", new Date("2020-01-01"));
        await invite(T.accepted, "existing@example.com", "accepted");
        await invite(T.rejected, "existing@example.com", "rejected");
        await invite(T.canceled, "existing@example.com", "canceled");
    });

    function anonymous() {
        return invitationsRouter.createCaller(
            // `createAuthenticatedMockContext` always carries a session; drop it for the
            // unauthenticated viewer.
            {
                ...createAuthenticatedMockContext({ user: { id: nanoId16() }, prisma: db }),
                auth: null,
            },
        );
    }

    function signedInAs(email: string) {
        return invitationsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: nanoId16(), email }, prisma: db }),
        );
    }

    it("reports an unknown invitation as not-found rather than an error", async () => {
        const result = await anonymous().getLanding({ invitationId: InvitationId.create() });

        expect(result).toEqual({ state: "not-found" });
    });

    it("describes a pending invitation to an anonymous viewer without an account", async () => {
        const result = await anonymous().getLanding({ invitationId: T.pending });

        expect(result).toEqual({
            state: "pending",
            organization: { name: "Mountain Rescue", slug: "mountain" },
            inviterName: "Alex Admin",
            email: "newcomer@example.com",
            personName: "Nia Newcomer",
            hasAccount: false,
            viewer: { kind: "anonymous" },
        });
    });

    it("says an account exists when one does", async () => {
        const result = await anonymous().getLanding({ invitationId: T.pendingKnown });

        expect(result).toMatchObject({ state: "pending", hasAccount: true, personName: null });
    });

    it("recognises the recipient, ignoring case", async () => {
        const result = await signedInAs("Existing@Example.com").getLanding({
            invitationId: T.pendingKnown,
        });

        expect(result).toMatchObject({ viewer: { kind: "recipient" } });
    });

    it("identifies a viewer signed in as somebody else", async () => {
        const result = await signedInAs("someone@else.com").getLanding({
            invitationId: T.pendingKnown,
        });

        expect(result).toMatchObject({ viewer: { kind: "other", email: "someone@else.com" } });
    });

    it.each([
        ["expired", T.expired, "expired"],
        ["accepted", T.accepted, "accepted"],
        ["rejected", T.rejected, "rejected"],
        ["canceled", T.canceled, "canceled"],
    ] as const)("reports a %s invitation's state", async (_label, invitationId, state) => {
        const result = await anonymous().getLanding({ invitationId });

        expect(result).toMatchObject({ state });
    });
});
