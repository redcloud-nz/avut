/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

// The router reaches server-only modules at import time. The procedures exercised here use
// ctx.prisma (the injected mock), so an empty stub is enough to let them import in jsdom.
vi.mock("server-only", () => ({}));

import { nanoId16 } from "@/lib/id";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { personnelRouter } from "./personnel-router";

describe("personnel.getInviteState", () => {
    // Dataset — one person per state the dialog has to render:
    //   linked     → already attached to memberUser
    //   member     → a user with that email is already a member of the org
    //   outsider   → has an AVUT account, but is not a member of this org
    //   stranger   → no user account anywhere
    //   cased      → account email differs only in case
    //   invited    → no account, but a pending invitation already exists
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        callerUser: UserId.create(),
        memberUser: UserId.create(),
        linkedUser: UserId.create(),
        outsiderUser: UserId.create(),
        casedUser: UserId.create(),
        linked: PersonId.create(),
        member: PersonId.create(),
        outsider: PersonId.create(),
        stranger: PersonId.create(),
        cased: PersonId.create(),
        invited: PersonId.create(),
        invitation: InvitationId.create(),
    };

    const db = createMockPrisma();

    async function person(id: PersonId, name: string, email: string) {
        await db.person.create({
            data: {
                id,
                organizationId: T.org,
                name,
                email,
                status: "Active",
                tags: [],
                properties: {},
            },
        });
    }

    async function user(id: UserId, name: string, email: string) {
        await db.user.create({ data: { id, name, email, emailVerified: true } });
    }

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });

        await person(T.linked, "Linked Lucy", "lucy@example.com");
        await person(T.member, "Member Mo", "mo@example.com");
        await person(T.outsider, "Outsider Ozzy", "ozzy@example.com");
        await person(T.stranger, "Stranger Sam", "sam@example.com");
        await person(T.cased, "Cased Cass", "Cass@Example.com");
        await person(T.invited, "Invited Ivy", "ivy@example.com");

        await user(T.callerUser, "Caller", "caller@example.com");
        await user(T.linkedUser, "Linked Lucy", "lucy@example.com");
        await user(T.memberUser, "Member Mo", "mo@example.com");
        await user(T.outsiderUser, "Outsider Ozzy", "ozzy@example.com");
        // Registered all-lowercase; the person record has it mixed-case.
        await user(T.casedUser, "Cased Cass", "cass@example.com");

        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.callerUser,
                role: "admin",
            },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.linkedUser,
                role: "member",
                personId: T.linked,
            },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.memberUser,
                role: "member",
            },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.casedUser,
                role: "member",
            },
        });
        // Ozzy belongs to a different organization, so he is not a member *here*.
        await db.organization.create({
            data: { id: T.otherOrg, name: "Other Org", slug: T.otherOrg, createdAt: new Date() },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.otherOrg,
                userId: T.outsiderUser,
                role: "member",
            },
        });

        await db.organizationInvitation.create({
            data: {
                id: T.invitation,
                organizationId: T.org,
                email: "ivy@example.com",
                status: "pending",
                expiresAt: new Date(Date.now() + 86_400_000),
                inviterId: T.callerUser,
                personId: T.invited,
            },
        });
    });

    function caller() {
        return personnelRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.callerUser },
                permissions: {
                    organization: ["view"],
                    invitation: ["view"],
                    member: ["view"],
                    person: ["view"],
                },
                prisma: db,
            }),
        );
    }

    it("reports Linked when the person already has a user account here", async () => {
        const result = await caller().getInviteState({
            organizationId: T.org,
            personId: T.linked,
        });

        expect(result.state).toBe("Linked");
    });

    it("reports AlreadyMember, with the user, when a member holds that email", async () => {
        const result = await caller().getInviteState({
            organizationId: T.org,
            personId: T.member,
        });

        // better-auth would reject an invitation here, so the dialog must offer a link instead.
        expect(result.state).toBe("AlreadyMember");
        expect(result.user?.id).toBe(T.memberUser);
    });

    it("reports UserExists when the account is real but belongs to another organization", async () => {
        const result = await caller().getInviteState({
            organizationId: T.org,
            personId: T.outsider,
        });

        expect(result.state).toBe("UserExists");
        expect(result.user?.id).toBe(T.outsiderUser);
    });

    it("reports NoUser when nobody has signed up with that email", async () => {
        const result = await caller().getInviteState({
            organizationId: T.org,
            personId: T.stranger,
        });

        expect(result.state).toBe("NoUser");
        expect(result.user).toBeNull();
    });

    // `Person.email` is admin-typed and may be mixed case; `User.email` is lowercase by
    // construction (better-auth normalises it at sign-up), so the lookup lowercases the needle.
    it("matches an account when the person record's email is mixed case", async () => {
        const result = await caller().getInviteState({
            organizationId: T.org,
            personId: T.cased,
        });

        expect(result.state).toBe("AlreadyMember");
        expect(result.user?.id).toBe(T.casedUser);
    });

    it("surfaces a pending invitation so the dialog can warn it will be replaced", async () => {
        const result = await caller().getInviteState({
            organizationId: T.org,
            personId: T.invited,
        });

        expect(result.state).toBe("NoUser");
        expect(result.pendingInvitation?.id).toBe(T.invitation);
    });

    it("reports no pending invitation for a person who has not been invited", async () => {
        const result = await caller().getInviteState({
            organizationId: T.org,
            personId: T.stranger,
        });

        expect(result.pendingInvitation).toBeNull();
    });

    it("throws NOT_FOUND for a person outside the organization", async () => {
        await expect(
            caller().getInviteState({ organizationId: T.org, personId: PersonId.create() }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});
