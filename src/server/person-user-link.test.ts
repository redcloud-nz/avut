/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";

import {
    findLinkableMember,
    findLinkablePerson,
    linkPersonOnInvitationAccept,
    tryLinkPersonToMember,
} from "./person-user-link";

describe("person↔user link matching", () => {
    // One organization, plus a second to prove the scope holds.
    //
    //   alice    Active, unlinked, alice@example.com     → the happy path
    //   bruno    Active, unlinked, Bruno@Example.com     → mixed-case person record
    //   cara     Active, LINKED to caraUser              → already taken
    //   dev      Archived, unlinked                      → not linkable
    //   erin     Active, unlinked, but in the other org  → out of scope
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        alice: PersonId.create(),
        bruno: PersonId.create(),
        cara: PersonId.create(),
        dev: PersonId.create(),
        erin: PersonId.create(),
        aliceUser: UserId.create(),
        brunoUser: UserId.create(),
        caraUser: UserId.create(),
        outsiderUser: UserId.create(),
        aliceMembership: nanoId16(),
        brunoMembership: nanoId16(),
        caraMembership: nanoId16(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        const person = (
            id: PersonId,
            organizationId: string,
            name: string,
            email: string,
            status: "Active" | "Archived" = "Active",
        ) =>
            db.person.create({
                data: { id, organizationId, name, email, status, tags: [], properties: {} },
            });

        await person(T.alice, T.org, "Alice", "alice@example.com");
        await person(T.bruno, T.org, "Bruno", "Bruno@Example.com");
        await person(T.cara, T.org, "Cara", "cara@example.com");
        await person(T.dev, T.org, "Dev", "dev@example.com", "Archived");
        await person(T.erin, T.otherOrg, "Erin", "erin@example.com");

        // better-auth lowercases User.email at sign-up, so every fixture does too.
        const user = (id: UserId, name: string, email: string) =>
            db.user.create({ data: { id, name, email, emailVerified: true } });

        await user(T.aliceUser, "Alice", "alice@example.com");
        await user(T.brunoUser, "Bruno", "bruno@example.com");
        await user(T.caraUser, "Cara", "cara@example.com");
        await user(T.outsiderUser, "Erin", "erin@example.com");

        const membership = (id: string, userId: UserId, personId?: PersonId) =>
            db.organizationUser.create({
                data: { id, organizationId: T.org, userId, role: "member", personId },
            });

        await membership(T.aliceMembership, T.aliceUser);
        await membership(T.brunoMembership, T.brunoUser);
        await membership(T.caraMembership, T.caraUser, T.cara);
        // Erin is a member of the *other* org only.
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.otherOrg,
                userId: T.outsiderUser,
                role: "member",
            },
        });
    });

    describe("findLinkablePerson", () => {
        it("finds the Active, unlinked person with a matching email", async () => {
            const person = await findLinkablePerson(db, {
                organizationId: T.org,
                email: "alice@example.com",
            });

            expect(person?.id).toBe(T.alice);
        });

        it("matches a person record whose email is mixed case", async () => {
            // The column is admin-typed and unnormalised — this is the case an index-backed
            // exact match would miss.
            const person = await findLinkablePerson(db, {
                organizationId: T.org,
                email: "bruno@example.com",
            });

            expect(person?.id).toBe(T.bruno);
        });

        it("skips a person already linked to a user", async () => {
            expect(
                await findLinkablePerson(db, {
                    organizationId: T.org,
                    email: "cara@example.com",
                }),
            ).toBeNull();
        });

        it("skips an archived person", async () => {
            expect(
                await findLinkablePerson(db, { organizationId: T.org, email: "dev@example.com" }),
            ).toBeNull();
        });

        it("does not reach across organizations", async () => {
            expect(
                await findLinkablePerson(db, { organizationId: T.org, email: "erin@example.com" }),
            ).toBeNull();

            expect(
                (
                    await findLinkablePerson(db, {
                        organizationId: T.otherOrg,
                        email: "erin@example.com",
                    })
                )?.id,
            ).toBe(T.erin);
        });

        it("returns null when nobody matches", async () => {
            expect(
                await findLinkablePerson(db, {
                    organizationId: T.org,
                    email: "nobody@example.com",
                }),
            ).toBeNull();
        });
    });

    describe("findLinkableMember", () => {
        it("finds an existing member with a matching email", async () => {
            const match = await findLinkableMember(db, {
                organizationId: T.org,
                email: "alice@example.com",
            });

            expect(match?.user.id).toBe(T.aliceUser);
            expect(match?.organizationUserId).toBe(T.aliceMembership);
        });

        it("lowercases the needle, since User.email is stored lowercase", async () => {
            const match = await findLinkableMember(db, {
                organizationId: T.org,
                email: "Bruno@Example.com",
            });

            expect(match?.user.id).toBe(T.brunoUser);
        });

        it("ignores a user who is not a member of this organization", async () => {
            // Erin has an account, but only belongs to the other org. Linking her here would mean
            // granting membership on an email match, which this never does.
            expect(
                await findLinkableMember(db, { organizationId: T.org, email: "erin@example.com" }),
            ).toBeNull();
        });

        it("ignores a member already linked to another person", async () => {
            expect(
                await findLinkableMember(db, { organizationId: T.org, email: "cara@example.com" }),
            ).toBeNull();
        });

        it("returns null when no account exists", async () => {
            expect(
                await findLinkableMember(db, {
                    organizationId: T.org,
                    email: "nobody@example.com",
                }),
            ).toBeNull();
        });
    });

    describe("tryLinkPersonToMember", () => {
        it("links, and reports the membership it wrote", async () => {
            const linked = await tryLinkPersonToMember(db, {
                organizationId: T.org,
                userId: T.aliceUser,
                personId: T.alice,
            });

            expect(linked).toBe(T.aliceMembership);

            const membership = await db.organizationUser.findFirst({
                where: { id: T.aliceMembership },
            });
            expect(membership?.personId).toBe(T.alice);
        });

        it("no-ops when the membership is already linked", async () => {
            // Alice was linked by the previous test; a second attempt must not overwrite.
            const linked = await tryLinkPersonToMember(db, {
                organizationId: T.org,
                userId: T.aliceUser,
                personId: T.bruno,
            });

            expect(linked).toBeNull();

            const membership = await db.organizationUser.findFirst({
                where: { id: T.aliceMembership },
            });
            expect(membership?.personId).toBe(T.alice);
        });

        it("no-ops when the person is already linked to someone else", async () => {
            const linked = await tryLinkPersonToMember(db, {
                organizationId: T.org,
                userId: T.brunoUser,
                personId: T.cara,
            });

            expect(linked).toBeNull();
        });

        it("no-ops when the user has no membership in the organization", async () => {
            expect(
                await tryLinkPersonToMember(db, {
                    organizationId: T.org,
                    userId: T.outsiderUser,
                    personId: T.bruno,
                }),
            ).toBeNull();
        });

        it("no-ops when the person belongs to a different organization", async () => {
            expect(
                await tryLinkPersonToMember(db, {
                    organizationId: T.org,
                    userId: T.brunoUser,
                    personId: T.erin,
                }),
            ).toBeNull();
        });
    });

    describe("linkPersonOnInvitationAccept", () => {
        // A second organization with its own fixtures, so these tests can write freely without
        // disturbing the shared dataset the lookup tests assert against.
        const A = {
            org: OrganizationId.create(),
            named: PersonId.create(),
            byEmail: PersonId.create(),
            unmatched: PersonId.create(),
            namedUser: UserId.create(),
            byEmailUser: UserId.create(),
            unmatchedUser: UserId.create(),
            namedMembership: nanoId16(),
            byEmailMembership: nanoId16(),
            unmatchedMembership: nanoId16(),
        };

        beforeAll(async () => {
            await db.organization.create({
                data: { id: A.org, name: A.org, slug: A.org, createdAt: new Date() },
            });

            await db.person.create({
                data: {
                    id: A.named,
                    organizationId: A.org,
                    name: "Named Nadia",
                    // Deliberately unlike the user's address: the invitation names her outright,
                    // so no email match is involved.
                    email: "nadia.personal@example.com",
                    status: "Active",
                    tags: [],
                    properties: {},
                },
            });
            await db.person.create({
                data: {
                    id: A.byEmail,
                    organizationId: A.org,
                    name: "Matched Mika",
                    email: "Mika@Example.com",
                    status: "Active",
                    tags: [],
                    properties: {},
                },
            });
            await db.person.create({
                data: {
                    id: A.unmatched,
                    organizationId: A.org,
                    name: "Unmatched Uli",
                    email: "uli@example.com",
                    status: "Active",
                    tags: [],
                    properties: {},
                },
            });

            await db.user.create({
                data: {
                    id: A.namedUser,
                    name: "Nadia",
                    email: "nadia.work@example.com",
                    emailVerified: true,
                },
            });
            await db.user.create({
                data: {
                    id: A.byEmailUser,
                    name: "Mika",
                    email: "mika@example.com",
                    emailVerified: true,
                },
            });
            await db.user.create({
                data: {
                    id: A.unmatchedUser,
                    name: "Nobody",
                    email: "nobody@example.com",
                    emailVerified: true,
                },
            });

            for (const [id, userId] of [
                [A.namedMembership, A.namedUser],
                [A.byEmailMembership, A.byEmailUser],
                [A.unmatchedMembership, A.unmatchedUser],
            ] as const) {
                await db.organizationUser.create({
                    data: { id, organizationId: A.org, userId, role: "member" },
                });
            }
        });

        const actor = (id: UserId, name: string, email: string) => ({ id, name, email });

        async function setAutoLink(enabled: boolean) {
            await db.organizationConfig.deleteMany({ where: { organizationId: A.org } });
            await db.organizationConfig.create({
                data: {
                    organizationId: A.org,
                    key: "personnel.autoLinkOnInviteAccept",
                    value: enabled,
                },
            });
        }

        it("applies the person the invitation names, ignoring the setting", async () => {
            // Off — an explicit invitation is an admin's decision, not an automation.
            await setAutoLink(false);

            const result = await linkPersonOnInvitationAccept(db, {
                organizationId: A.org,
                actor: actor(A.namedUser, "Nadia", "nadia.work@example.com"),
                invitationPersonId: A.named,
            });

            expect(result).toEqual({
                personId: A.named,
                organizationUserId: A.namedMembership,
            });

            const membership = await db.organizationUser.findFirst({
                where: { id: A.namedMembership },
            });
            expect(membership?.personId).toBe(A.named);
        });

        it("writes an audit entry naming the trigger", async () => {
            const entries = await db.logEntry.findMany({
                where: { objectId: A.namedMembership },
            });

            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({
                scope: "organization",
                organizationId: A.org,
                userId: A.namedUser,
                action: "Update",
                objectType: "OrganizationMembership",
            });
            expect(entries[0].description).toContain("the invitation named the person");
            expect(entries[0].actorLabel).toBe("Nadia <nadia.work@example.com>");
        });

        it("does nothing on an email match while the setting is off", async () => {
            await setAutoLink(false);

            expect(
                await linkPersonOnInvitationAccept(db, {
                    organizationId: A.org,
                    actor: actor(A.byEmailUser, "Mika", "mika@example.com"),
                    invitationPersonId: null,
                }),
            ).toBeNull();

            const membership = await db.organizationUser.findFirst({
                where: { id: A.byEmailMembership },
            });
            expect(membership?.personId).toBeNull();
        });

        it("links on an email match once the setting is on", async () => {
            await setAutoLink(true);

            const result = await linkPersonOnInvitationAccept(db, {
                organizationId: A.org,
                actor: actor(A.byEmailUser, "Mika", "mika@example.com"),
                invitationPersonId: null,
            });

            // The person record's address is mixed case; the user's is not.
            expect(result).toEqual({
                personId: A.byEmail,
                organizationUserId: A.byEmailMembership,
            });

            const entries = await db.logEntry.findMany({
                where: { objectId: A.byEmailMembership },
            });
            expect(entries).toHaveLength(1);
            expect(entries[0].description).toContain("matched on email address");
        });

        it("does nothing when no person matches, even with the setting on", async () => {
            await setAutoLink(true);

            expect(
                await linkPersonOnInvitationAccept(db, {
                    organizationId: A.org,
                    actor: actor(A.unmatchedUser, "Nobody", "nobody@example.com"),
                    invitationPersonId: null,
                }),
            ).toBeNull();
        });

        it("writes no audit entry when the link is not made", async () => {
            expect(
                await db.logEntry.findMany({ where: { objectId: A.unmatchedMembership } }),
            ).toHaveLength(0);
        });

        it("no-ops when the named person is already linked to someone else", async () => {
            await setAutoLink(false);

            // Uli's membership is still unlinked, but Nadia's person record is taken.
            expect(
                await linkPersonOnInvitationAccept(db, {
                    organizationId: A.org,
                    actor: actor(A.unmatchedUser, "Nobody", "nobody@example.com"),
                    invitationPersonId: A.named,
                }),
            ).toBeNull();

            expect(
                await db.logEntry.findMany({ where: { objectId: A.unmatchedMembership } }),
            ).toHaveLength(0);
        });
    });
});
