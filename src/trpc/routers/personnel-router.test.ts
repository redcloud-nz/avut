/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import { OrganizationUserId } from "@/lib/schemas/organization-user";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import * as Personnel from "@/server/services/personnel";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext, createOrganizationMockContext } from "@/test/trpc-helpers";

import { personnelRouter } from "./personnel-router";

// The router reaches server-only modules at import time. The procedures exercised here use
// ctx.prisma (the injected mock), so an empty stub is enough to let them import in jsdom.
vi.mock("server-only", () => ({}));

describe("personnel.getInviteState", () => {
    // Dataset — one person per state the dialog has to render:
    //   linked     → already attached to memberUser
    //   member     → a user with that email is already a member of the org
    //   outsider   → has an AVUT account, but is not a member of this org
    //   stranger   → no user account anywhere
    //   cased      → account email differs only in case
    //   invited    → no account, but a pending invitation already exists
    //   elsewhere  → a member holds that email, but their account is linked to `holder`
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        callerUser: UserId.create(),
        memberUser: UserId.create(),
        linkedUser: UserId.create(),
        outsiderUser: UserId.create(),
        casedUser: UserId.create(),
        elsewhereUser: UserId.create(),
        linked: PersonId.create(),
        member: PersonId.create(),
        outsider: PersonId.create(),
        stranger: PersonId.create(),
        cased: PersonId.create(),
        invited: PersonId.create(),
        elsewhere: PersonId.create(),
        holder: PersonId.create(),
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
        await person(T.elsewhere, "Elsewhere Eli", "eli@example.com");
        await person(T.holder, "Holder Hana", "hana@example.com");

        await user(T.callerUser, "Caller", "caller@example.com");
        await user(T.linkedUser, "Linked Lucy", "lucy@example.com");
        await user(T.memberUser, "Member Mo", "mo@example.com");
        await user(T.outsiderUser, "Outsider Ozzy", "ozzy@example.com");
        // Registered all-lowercase; the person record has it mixed-case.
        await user(T.casedUser, "Cased Cass", "cass@example.com");
        await user(T.elsewhereUser, "Elsewhere Eli", "eli@example.com");

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
        // A member whose account is already spoken for by a different person record.
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.elsewhereUser,
                role: "member",
                personId: T.holder,
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

    it("reports MemberLinkedElsewhere when that member is already linked to another person", async () => {
        // Not AlreadyMember: offering "Link Account" here would overwrite the holder's link.
        // Not UserExists either — better-auth refuses an invitation for an existing member.
        const state = await caller().getInviteState({
            organizationId: T.org,
            personId: T.elsewhere,
        });

        expect(state.state).toBe("MemberLinkedElsewhere");
        expect(state.user?.id).toBe(T.elsewhereUser);
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

describe("personnel.createPerson auto-link", () => {
    // memberUser is an existing member holding chris@example.com with no person attached.
    // outsiderUser has an account and that email, but belongs to another organization.
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        adminUser: UserId.create(),
        memberUser: UserId.create(),
        offUser: UserId.create(),
        outsiderUser: UserId.create(),
        memberMembership: nanoId16(),
        offMembership: nanoId16(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        await db.user.create({
            data: { id: T.adminUser, name: "Admin", email: "admin@example.com" },
        });
        await db.user.create({
            data: { id: T.memberUser, name: "Chris", email: "chris@example.com" },
        });
        await db.user.create({
            data: { id: T.offUser, name: "Dana", email: "dana@example.com" },
        });
        await db.user.create({
            data: { id: T.outsiderUser, name: "Outsider", email: "outsider@example.com" },
        });

        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: T.org, userId: T.adminUser, role: "admin" },
        });
        await db.organizationUser.create({
            data: {
                id: T.memberMembership,
                organizationId: T.org,
                userId: T.memberUser,
                role: "member",
            },
        });
        await db.organizationUser.create({
            data: {
                id: T.offMembership,
                organizationId: T.org,
                userId: T.offUser,
                role: "member",
            },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.otherOrg,
                userId: T.outsiderUser,
                role: "member",
            },
        });
    });

    async function setAutoLink(enabled: boolean) {
        await db.organizationConfig.deleteMany({ where: { organizationId: T.org } });
        await db.organizationConfig.create({
            data: {
                organizationId: T.org,
                key: "personnel.autoLinkOnPersonCreate",
                value: enabled,
            },
        });
    }

    function caller() {
        return personnelRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.adminUser },
                permissions: { organization: ["view"], person: ["create"] },
                prisma: db,
            }),
        );
    }

    function newPerson(name: string, email: string) {
        return { name, email, tags: [], properties: {} };
    }

    it("does not link while the setting is off", async () => {
        await setAutoLink(false);
        const personId = PersonId.create();

        await caller().createPerson({
            organizationId: T.org,
            personId,
            create: newPerson("Dana Creator", "dana@example.com"),
        });

        // Assert on what is linked rather than on the column's empty value — prisma-mock
        // reports an unset optional as undefined, not null.
        expect(await db.organizationUser.findMany({ where: { personId } })).toHaveLength(0);

        const membership = await db.organizationUser.findFirst({
            where: { id: T.offMembership },
        });
        expect(membership?.personId ?? null).toBeNull();
    });

    it("links to an existing member once the setting is on", async () => {
        await setAutoLink(true);
        const personId = PersonId.create();

        await caller().createPerson({
            organizationId: T.org,
            personId,
            // Mixed case on the way in; User.email is stored lowercase.
            create: newPerson("Chris Member", "Chris@Example.com"),
        });

        const membership = await db.organizationUser.findFirst({
            where: { id: T.memberMembership },
        });
        expect(membership?.personId).toBe(personId);
    });

    it("writes a membership audit entry alongside the person entry", async () => {
        const entries = await db.logEntry.findMany({ where: { objectId: T.memberMembership } });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "organization",
            organizationId: T.org,
            userId: T.adminUser,
            action: "Update",
            objectType: "OrganizationMembership",
        });
        expect(entries[0].description).toContain("matched on email address");
    });

    it("does not link, or grant membership, to a user outside the organization", async () => {
        await setAutoLink(true);
        const personId = PersonId.create();

        await caller().createPerson({
            organizationId: T.org,
            personId,
            create: newPerson("Outsider Person", "outsider@example.com"),
        });

        // No membership created for them here, and no link anywhere.
        const memberships = await db.organizationUser.findMany({
            where: { organizationId: T.org, userId: T.outsiderUser },
        });
        expect(memberships).toHaveLength(0);

        const linked = await db.organizationUser.findMany({ where: { personId } });
        expect(linked).toHaveLength(0);
    });

    it("still creates the person when nothing matches", async () => {
        await setAutoLink(true);
        const personId = PersonId.create();

        const { created } = await caller().createPerson({
            organizationId: T.org,
            personId,
            create: newPerson("Nobody Here", "nobody@example.com"),
        });

        expect(created.id).toBe(personId);
        expect(await db.logEntry.findMany({ where: { objectId: personId } })).toHaveLength(1);
    });

    it("attributes both entries to the acting admin, not the linked user", async () => {
        const membershipEntry = (
            await db.logEntry.findMany({ where: { objectId: T.memberMembership } })
        )[0];

        expect(membershipEntry.userId).toBe(T.adminUser);
        expect(membershipEntry.userId).not.toBe(T.memberUser);
    });
});

describe("personnel email normalisation", () => {
    // `personnel.email` is stored lowercase so that `@@unique([organizationId, email])` means what
    // it says — Postgres unique indexes are case-sensitive, so before this both conflict checks
    // below let a case-variant through and one human ended up split across two person records.
    // See docs/specs/person-email-normalisation.md.
    const T = {
        org: OrganizationId.create(),
        adminUser: UserId.create(),
        dana: PersonId.create(),
        evan: PersonId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });

        await db.user.create({
            data: { id: T.adminUser, name: "Admin", email: "admin@example.com" },
        });
        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: T.org, userId: T.adminUser, role: "admin" },
        });

        for (const [id, name, email] of [
            [T.dana, "Dana Reed", "dana.reed@example.com"],
            [T.evan, "Evan Stone", "evan.stone@example.com"],
        ] as const) {
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
    });

    function caller() {
        return personnelRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.adminUser },
                permissions: { organization: ["view"], person: ["create", "update", "view"] },
                prisma: db,
            }),
        );
    }

    it("stores a new person's email lowercased", async () => {
        const personId = PersonId.create();

        const { created } = await caller().createPerson({
            organizationId: T.org,
            personId,
            create: {
                name: "Farah Nabi",
                email: "Farah.Nabi@Example.COM",
                tags: [],
                properties: {},
            },
        });

        expect(created.email).toBe("farah.nabi@example.com");
        expect((await db.person.findUnique({ where: { id: personId } }))?.email).toBe(
            "farah.nabi@example.com",
        );
    });

    it("rejects a new person whose email differs from an existing one only by case", async () => {
        await expect(
            caller().createPerson({
                organizationId: T.org,
                personId: PersonId.create(),
                create: {
                    name: "Dana Reed",
                    email: "Dana.Reed@Example.com",
                    tags: [],
                    properties: {},
                },
            }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("rejects an update that turns an email into a case-variant of another person's", async () => {
        await expect(
            caller().updatePerson({
                organizationId: T.org,
                personId: T.evan,
                update: {
                    name: "Evan Stone",
                    email: "DANA.REED@example.com",
                    tags: [],
                    properties: {},
                },
            }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("finds a person by a mixed-case needle", async () => {
        // Only possible now that the stored side cannot vary: the previous
        // `mode: "insensitive"` form returned null under prisma-mock, so this was untestable.
        const ctx = createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.adminUser },
            prisma: db,
        });

        expect((await Personnel.getByEmail(ctx, "Dana.Reed@EXAMPLE.com"))?.id).toBe(T.dana);
        expect(await Personnel.getByEmail(ctx, "nobody@example.com")).toBeNull();
    });
});

describe("personnel.getLinkedUser", () => {
    // Dataset: `linked` is attached to a two-role member; `unlinked` has no membership.
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        linked: PersonId.create(),
        unlinked: PersonId.create(),
        membership: OrganizationUserId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });
        await db.user.create({
            data: { id: T.user, name: "Lucy", email: "lucy@example.com", emailVerified: true },
        });
        for (const [id, name] of [
            [T.linked, "Linked Lucy"],
            [T.unlinked, "Unlinked Uma"],
        ] as const) {
            await db.person.create({
                data: {
                    id,
                    organizationId: T.org,
                    name,
                    email: `${name.split(" ")[1].toLowerCase()}@example.com`,
                    status: "Active",
                    tags: [],
                    properties: {},
                },
            });
        }
        await db.organizationUser.create({
            data: {
                id: T.membership,
                organizationId: T.org,
                userId: T.user,
                role: "member,i3-editor",
                personId: T.linked,
            },
        });
    });

    function caller() {
        return personnelRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], member: ["view"], person: ["view"] },
                prisma: db,
            }),
        );
    }

    it("returns the membership row with the user composed alongside it", async () => {
        const result = await caller().getLinkedUser({ organizationId: T.org, personId: T.linked });

        expect(result).toMatchObject({
            organizationUserId: T.membership,
            organizationId: T.org,
            userId: T.user,
            personId: T.linked,
            roles: ["member", "i3-editor"],
            user: { id: T.user, name: "Lucy", email: "lucy@example.com" },
        });
        expect(result).not.toHaveProperty("name");
        expect(result).not.toHaveProperty("email");
    });

    it("returns null for a person with no linked user", async () => {
        expect(
            await caller().getLinkedUser({ organizationId: T.org, personId: T.unlinked }),
        ).toBeNull();
    });

    it("rejects an unknown person", async () => {
        await expect(
            caller().getLinkedUser({ organizationId: T.org, personId: PersonId.create() }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});
