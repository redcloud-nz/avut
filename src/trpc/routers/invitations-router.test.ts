/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// `signUp` delegates account creation and sign-in to Better Auth. The tests assert on that
// delegation — and on what surrounds it — rather than standing up a real auth instance.
const signUpEmailMock = vi.fn();
const signInEmailMock = vi.fn();
vi.mock("@/server/auth", () => ({
    auth: {
        api: {
            signUpEmail: (...args: unknown[]) => signUpEmailMock(...args),
            signInEmail: (...args: unknown[]) => signInEmailMock(...args),
        },
    },
}));

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { isVerificationOtpEmailSuppressed } from "@/server/verification-otp-suppression";
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

describe("invitations.signUp", () => {
    // Dataset:
    //   known    → pending, existing@example.com, who already has an account
    //   expired / accepted → not usable
    // Plus a `fresh` invitation created anew for every test (see `beforeEach`): signing up
    // consumes the address, so tests can't share one.
    const T = {
        org: OrganizationId.create(),
        inviter: UserId.create(),
        existing: UserId.create(),
        known: InvitationId.create(),
        expired: InvitationId.create(),
        accepted: InvitationId.create(),
    };

    const db = createMockPrisma();
    const password = "correct-horse-battery";

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Mountain Rescue", slug: "mountain", createdAt: new Date() },
        });
        for (const [id, email] of [
            [T.inviter, "admin@example.com"],
            [T.existing, "existing@example.com"],
        ] as const) {
            await db.user.create({ data: { id, name: email, email, emailVerified: true } });
        }

        await invite(T.known, "existing@example.com", "pending");
        await invite(T.expired, "late@example.com", "pending", new Date("2020-01-01"));
        await invite(T.accepted, "done@example.com", "accepted");
    });

    function invite(
        id: string,
        email: string,
        status: string,
        expiresAt = new Date("2099-01-01T00:00:00Z"),
    ) {
        return db.organizationInvitation.create({
            data: {
                id,
                email,
                status,
                expiresAt,
                organizationId: T.org,
                inviterId: T.inviter,
                role: "member",
            },
        });
    }

    let fresh: InvitationId;
    let freshEmail: string;
    let suppressedDuringSignUp: boolean | undefined;

    beforeEach(async () => {
        // Mixed case on purpose: the account must be created for the lowercased address.
        const local = nanoId16().toLowerCase();
        fresh = InvitationId.create();
        freshEmail = `${local}@example.com`;
        await invite(fresh, `${local}@Example.COM`, "pending");

        suppressedDuringSignUp = undefined;
        signUpEmailMock.mockReset();
        signInEmailMock.mockReset();
        signUpEmailMock.mockImplementation(
            async ({ body }: { body: { name: string; email: string } }) => {
                suppressedDuringSignUp = isVerificationOtpEmailSuppressed();
                const user = await db.user.create({
                    data: {
                        id: UserId.create(),
                        name: body.name,
                        email: body.email,
                        emailVerified: false,
                    },
                });
                return { token: null, user };
            },
        );
    });

    function caller(signedIn = false) {
        const ctx = createAuthenticatedMockContext({ user: { id: nanoId16() }, prisma: db });
        return invitationsRouter.createCaller(signedIn ? ctx : { ...ctx, auth: null });
    }

    it("creates a verified account for the invited address and signs it in", async () => {
        const { userId } = await caller().signUp({
            invitationId: fresh,
            name: "Nia Newcomer",
            password,
        });

        const user = await db.user.findUnique({ where: { id: userId } });
        expect(user).toMatchObject({
            email: freshEmail,
            name: "Nia Newcomer",
            emailVerified: true,
        });
        expect(signInEmailMock).toHaveBeenCalledWith(
            expect.objectContaining({ body: { email: freshEmail, password } }),
        );
    });

    it("sends the verification code email nowhere — the sign-up runs with it suppressed", async () => {
        await caller().signUp({ invitationId: fresh, name: "Nia Newcomer", password });

        expect(suppressedDuringSignUp).toBe(true);
        // And only there: it doesn't leak past the call.
        expect(isVerificationOtpEmailSuppressed()).toBe(false);
    });

    it("takes the email from the invitation, never from the caller", async () => {
        await caller().signUp({ invitationId: fresh, name: "Nia Newcomer", password });

        expect(signUpEmailMock).toHaveBeenCalledWith(
            expect.objectContaining({
                body: { name: "Nia Newcomer", email: freshEmail, password },
            }),
        );
    });

    it("records who created the account, and from which invitation, on the new user's own log", async () => {
        const { userId } = await caller().signUp({
            invitationId: fresh,
            name: "Nia Newcomer",
            password,
        });

        const entries = await db.logEntry.findMany({ where: { objectId: userId } });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "user",
            ownerId: userId,
            userId,
            action: "Create",
            objectType: "User",
        });
        expect(entries[0].description).toContain("Mountain Rescue");
    });

    it("refuses when an account already exists for the address", async () => {
        await expect(
            caller().signUp({ invitationId: T.known, name: "Impostor", password }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect(signUpEmailMock).not.toHaveBeenCalled();
    });

    it.each([
        ["expired", T.expired],
        ["already accepted", T.accepted],
        ["unknown", InvitationId.create()],
    ])("refuses an invitation that is %s", async (_label, invitationId) => {
        await expect(
            caller().signUp({ invitationId, name: "Nia Newcomer", password }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(signUpEmailMock).not.toHaveBeenCalled();
    });

    it("refuses a caller who is already signed in", async () => {
        await expect(
            caller(true).signUp({ invitationId: fresh, name: "Nia Newcomer", password }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(signUpEmailMock).not.toHaveBeenCalled();
    });

    it("rejects a password that fails the policy before touching Better Auth", async () => {
        await expect(
            caller().signUp({ invitationId: fresh, name: "Nia Newcomer", password: "short" }),
        ).rejects.toThrow();
        expect(signUpEmailMock).not.toHaveBeenCalled();
    });
});
