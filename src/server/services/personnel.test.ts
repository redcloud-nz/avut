/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { createLogBatch } from "@/server/log-entry";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as Personnel from "./personnel";
import { withBatch } from "./service-context";

const {
    findLinkableMember,
    findLinkablePerson,
    linkPersonOnInvitationAccept,
    tryLinkPersonToMember,
} = Personnel;

// The service reaches server-only modules at import time. The functions exercised here use an
// injected prisma client, so an empty stub is enough to let it import in jsdom.
vi.mock("server-only", () => ({}));

describe("person↔user link matching", () => {
    // One organization, plus a second to prove the scope holds.
    //
    //   alice    Active, unlinked, alice@example.com     → the happy path
    //   bruno    Active, unlinked, bruno@example.com     → mixed-case *needle* in both lookups
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
        await person(T.bruno, T.org, "Bruno", "bruno@example.com");
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

        it("matches whatever casing the caller passes", async () => {
            // `personnel.email` is stored lowercase now, so the stored side can no longer vary.
            // The needle still can: it arrives from a form, from better-auth, or from D4H.
            const person = await findLinkablePerson(db, {
                organizationId: T.org,
                email: "Bruno@Example.COM",
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
                    email: "mika@example.com",
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

            // Matched on email alone — this invitation carried no personId.
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

/*
 * The D4H team import reaches the auto-link through `Personnel.create`, binding a batch via
 * `withBatch` rather than passing a tRPC procedure's context straight through — so this path is
 * unreachable through `personnelRouter.createCaller` and was the one part of the branch with no
 * automated coverage at all.
 *
 * What is specific to the import, and therefore what these cases exist to pin down:
 *  - the link fires for a person the import creates, not just one an admin types in;
 *  - **both** entries join the import's batch, so the membership link is traceable to the run
 *    that caused it rather than appearing as an orphan edit by whoever started the import;
 *  - the organization's opt-in still governs an unattended run.
 */
describe("Personnel.create during a D4H team import", () => {
    // One member per case, each with a distinct email. Deliberately no shared fixture and no
    // case-variant reuse: two people whose emails differ only in case can coexist today only
    // because of the defect `docs/specs/person-email-normalisation.md` exists to fix, and a test
    // that leans on it would start failing for the right reason at the worst moment.
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        importerUser: UserId.create(),
        linkUser: UserId.create(),
        batchUser: UserId.create(),
        offUser: UserId.create(),
        outsiderUser: UserId.create(),
        linkMembership: nanoId16(),
        batchMembership: nanoId16(),
        offMembership: nanoId16(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        const users: [UserId, string, string][] = [
            [T.importerUser, "Importer", "importer@example.com"],
            [T.linkUser, "Rae Fenn", "rae.fenn@example.com"],
            [T.batchUser, "Bea Quill", "bea.quill@example.com"],
            [T.offUser, "Dana Vos", "dana.vos@example.com"],
            // An account with the same email as an imported member, but in another organization.
            [T.outsiderUser, "Outsider", "outsider@example.com"],
        ];
        for (const [id, name, email] of users) {
            await db.user.create({ data: { id, name, email } });
        }

        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: T.org, userId: T.importerUser, role: "admin" },
        });

        const memberships: [string, UserId][] = [
            [T.linkMembership, T.linkUser],
            [T.batchMembership, T.batchUser],
            [T.offMembership, T.offUser],
        ];
        for (const [id, userId] of memberships) {
            await db.organizationUser.create({
                data: { id, organizationId: T.org, userId, role: "member" },
            });
        }

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

    function ctx() {
        return createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.importerUser, name: "Importer", email: "importer@example.com" },
            permissions: { organization: ["view"], person: ["create"] },
            prisma: db,
        });
    }

    /** Open a batch the way the team import does, then create one person through the service. */
    async function importPerson(name: string, email: string) {
        const batch = await createLogBatch(
            {
                operationKey: "d4h-team-import",
                userId: T.importerUser,
                actorLabel: "Importer <importer@example.com>",
                description: `Imported ${name} from D4H.`,
            },
            db,
        );

        const personId = PersonId.create();
        await Personnel.create(withBatch(ctx(), batch.id), personId, {
            name,
            email,
            tags: [],
            properties: {},
        });

        return { personId, batchId: batch.id };
    }

    it("links an imported person to the member who already holds that email", async () => {
        await setAutoLink(true);

        const { personId } = await importPerson("Rae Fenn", "rae.fenn@example.com");

        const membership = await db.organizationUser.findFirst({
            where: { id: T.linkMembership },
        });
        expect(membership?.personId).toBe(personId);
    });

    it("puts the person entry in the import's batch", async () => {
        await setAutoLink(true);

        const { personId, batchId } = await importPerson("Nobody Here", "nobody@example.com");

        const entries = await db.logEntry.findMany({ where: { objectId: personId } });
        expect(entries).toHaveLength(1);
        expect(entries[0].batchId).toBe(batchId);
    });

    // The reason a batch exists: an unattended run must stay traceable to the operation that
    // produced it. A membership entry outside the batch reads as an unexplained edit by whoever
    // happened to start the import.
    it("carries the same batch onto the membership link entry", async () => {
        await setAutoLink(true);

        const { batchId } = await importPerson("Bea Quill", "bea.quill@example.com");

        const linkEntry = (
            await db.logEntry.findMany({
                where: { objectId: T.batchMembership, objectType: "OrganizationMembership" },
            })
        )[0];

        expect(linkEntry.batchId).toBe(batchId);
        expect(linkEntry.description).toContain("on creation — matched on email address.");
    });

    it("respects the organization's opt-in, even unattended", async () => {
        await setAutoLink(false);

        const { personId } = await importPerson("Dana Vos", "dana.vos@example.com");

        expect(await db.organizationUser.findMany({ where: { personId } })).toHaveLength(0);

        const membership = await db.organizationUser.findFirst({
            where: { id: T.offMembership },
        });
        expect(membership?.personId ?? null).toBeNull();

        expect(await db.logEntry.findMany({ where: { objectId: T.offMembership } })).toHaveLength(
            0,
        );
    });

    // The invariant that matters most on an unattended path: an email match is not authorisation.
    it("never grants membership to an imported email belonging to an outsider", async () => {
        await setAutoLink(true);

        const { personId } = await importPerson("Outsider", "outsider@example.com");

        expect(
            await db.organizationUser.findMany({
                where: { organizationId: T.org, userId: T.outsiderUser },
            }),
        ).toHaveLength(0);
        expect(await db.organizationUser.findMany({ where: { personId } })).toHaveLength(0);
    });
});

describe("Personnel.archive / restoreFromArchive / restoreFromTrash / deleteRecord", () => {
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        person: PersonId.create(),
        team: nanoId16(),
        assessor: PersonId.create(),
        pkg: nanoId16(),
        group: nanoId16(),
        skill: nanoId16(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.person.create({
            data: {
                id: T.person,
                organizationId: T.org,
                name: "Grace Hopper",
                email: "grace-lifecycle@example.com",
                tags: [],
                properties: {},
            },
        });
        await db.person.create({
            data: {
                id: T.assessor,
                organizationId: T.org,
                name: "Ada Lovelace",
                email: "ada-lifecycle@example.com",
                tags: [],
                properties: {},
            },
        });
        await db.team.create({
            data: { id: T.team, organizationId: T.org, name: "Alpha", tags: [], properties: {} },
        });
        await db.teamMembership.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                teamId: T.team,
                personId: T.person,
                tags: [],
                properties: {},
            },
        });
        await db.skillPackage.create({
            data: {
                id: T.pkg,
                organizationId: T.org,
                name: "First Aid",
                description: "",
                properties: {},
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.group,
                skillPackageId: T.pkg,
                name: "Basics",
                description: "",
                properties: {},
            },
        });
        await db.skill.create({
            data: {
                id: T.skill,
                skillPackageId: T.pkg,
                skillGroupId: T.group,
                name: "CPR",
                description: "",
                properties: {},
                frequency: 12,
            },
        });
        await db.skillCheck.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                assesseeId: T.person,
                assessorId: T.assessor,
                skillId: T.skill,
                result: "Pass",
                notes: "",
                status: "Include",
            },
        });
    });

    function ctx() {
        return createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.user },
            permissions: {},
            prisma: db,
        });
    }

    it("archive moves an Active person to Archived and is idempotent", async () => {
        const archived = await Personnel.archive(ctx(), T.person);
        expect(archived.status).toBe("Archived");

        const entries = await db.logEntry.findMany({
            where: { objectType: "Person", objectId: T.person, action: "Archive" },
        });
        expect(entries).toHaveLength(1);

        await Personnel.archive(ctx(), T.person);
        expect(
            await db.logEntry.findMany({
                where: { objectType: "Person", objectId: T.person, action: "Archive" },
            }),
        ).toHaveLength(1);
    });

    it("restoreFromTrash rejects an Archived person", async () => {
        await expect(Personnel.restoreFromTrash(ctx(), T.person)).rejects.toThrow(
            /only a Deleted person can be restored from trash/,
        );
    });

    it("restoreFromArchive moves an Archived person back to Active", async () => {
        const restored = await Personnel.restoreFromArchive(ctx(), T.person);
        expect(restored.status).toBe("Active");
    });

    it("restoreFromArchive rejects a Deleted person", async () => {
        await Personnel.deleteRecord(ctx(), T.person);
        await expect(Personnel.restoreFromArchive(ctx(), T.person)).rejects.toThrow(
            /only an Archived person can be restored from archive/,
        );
    });

    it("deleteRecord does not touch the person's team membership", async () => {
        const membership = await db.teamMembership.findFirst({ where: { personId: T.person } });
        expect(membership).toMatchObject({ status: "Active" });
    });

    it("restoreFromTrash moves a Deleted person back to Active", async () => {
        const restored = await Personnel.restoreFromTrash(ctx(), T.person);
        expect(restored.status).toBe("Active");

        const entries = await db.logEntry.findMany({
            where: { objectType: "Person", objectId: T.person, action: "Restore" },
        });
        expect(entries.length).toBeGreaterThanOrEqual(1);
    });

    it("getDeleteImpact counts active team memberships and skill checks", async () => {
        expect(await Personnel.getDeleteImpact(ctx(), T.person)).toEqual({
            teamCount: 1,
            skillCheckCount: 1,
        });
    });
});
