/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { cacheTag, revalidateTag } from "next/cache";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { ProviderCredentialId, type Provider } from "@/lib/schemas/provider-credential";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";

import {
    getOrganizationProviderCredential,
    getProviderCredentialForOwner,
    revalidateProviderCredential,
    type ProviderCredentialRef,
} from "./provider-credential";

// provider-credential imports the real Prisma client; swap in the in-memory one. `vi.hoisted`
// because vi.mock factories run before the module's own imports.
const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("./prisma", () => ({
    get default() {
        return db.current;
    },
}));

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), revalidateTag: vi.fn() }));

vi.mock("@/server/encrypt", () => ({
    decryptDBValue: (value: string) => value.replace(/^encrypted:/, ""),
}));

describe("getOrganizationProviderCredential", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        orgCredential: ProviderCredentialId.create(),
        groupCredential: ProviderCredentialId.create(),
        otherOrgCredential: ProviderCredentialId.create(),
        personalCredential: ProviderCredentialId.create(),
        user: UserId.create(),
    };

    beforeAll(async () => {
        const prisma = createMockPrisma();
        db.current = prisma;

        for (const id of [T.org, T.otherOrg]) {
            await prisma.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        await prisma.user.create({
            data: { id: T.user, name: "U", email: `${T.user}@x.test`, emailVerified: true },
        });

        const seed = (
            id: string,
            organizationId: string,
            groupId: string | null,
            userId: string | null = null,
        ) =>
            prisma.providerCredential.create({
                data: {
                    id,
                    provider: "D4H",
                    organizationId,
                    userId,
                    groupId,
                    label: "Seeded",
                    token: "encrypted:secret",
                    status: "OK",
                    expiresAt: new Date("2036-01-01T00:00:00Z"),
                    metadata: {
                        provider: "D4H",
                        serverCode: "us",
                        d4HTeams: [],
                        d4HOrganisations: [],
                    },
                },
            });

        await seed(T.orgCredential, T.org, null);
        await seed(T.groupCredential, T.org, nanoId16());
        await seed(T.otherOrgCredential, T.otherOrg, null);
        await seed(T.personalCredential, T.org, null, T.user);
    });

    it("returns the organization's own credential, decrypted", async () => {
        const credential = await getOrganizationProviderCredential({
            provider: "D4H",
            organizationId: T.org,
            credentialId: T.orgCredential,
        });

        expect(credential?.id).toBe(T.orgCredential);
        expect(credential?.token).toBe("secret");
    });

    it("never returns a group-owned credential", async () => {
        expect(
            await getOrganizationProviderCredential({
                provider: "D4H",
                organizationId: T.org,
                credentialId: T.groupCredential,
            }),
        ).toBeNull();
    });

    it("never returns another organization's credential", async () => {
        expect(
            await getOrganizationProviderCredential({
                provider: "D4H",
                organizationId: T.org,
                credentialId: T.otherOrgCredential,
            }),
        ).toBeNull();
    });

    it("returns null, not an error, for a member's personal credential in the same organization", async () => {
        expect(
            await getOrganizationProviderCredential({
                provider: "D4H",
                organizationId: T.org,
                credentialId: T.personalCredential,
            }),
        ).toBeNull();
    });

    it("doesn't skip the ownership check for an empty organization ID", async () => {
        expect(
            await getOrganizationProviderCredential({
                provider: "D4H",
                organizationId: "" as OrganizationId,
                credentialId: T.orgCredential,
            }),
        ).toBeNull();
    });
});

describe("getProviderCredentialForOwner", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        otherUser: UserId.create(),
        orgCredential: ProviderCredentialId.create(),
        groupCredential: ProviderCredentialId.create(),
        personalCredential: ProviderCredentialId.create(),
        otherUserCredential: ProviderCredentialId.create(),
    };

    beforeAll(async () => {
        const prisma = createMockPrisma();
        db.current = prisma;

        for (const id of [T.org, T.otherOrg]) {
            await prisma.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        for (const id of [T.user, T.otherUser]) {
            await prisma.user.create({
                data: { id, name: "U", email: `${id}@x.test`, emailVerified: true },
            });
        }

        const seed = (id: string, userId: string | null, groupId: string | null = null) =>
            prisma.providerCredential.create({
                data: {
                    id,
                    provider: "D4H",
                    organizationId: T.org,
                    userId,
                    groupId,
                    label: "Seeded",
                    token: "encrypted:secret",
                    status: "OK",
                    expiresAt: new Date("2036-01-01T00:00:00Z"),
                    metadata: {
                        provider: "D4H",
                        serverCode: "us",
                        d4HTeams: [],
                        d4HOrganisations: [],
                    },
                },
            });

        await seed(T.orgCredential, null);
        await seed(T.groupCredential, null, nanoId16());
        await seed(T.personalCredential, T.user);
        await seed(T.otherUserCredential, T.otherUser);
    });

    const orgRef = (credentialId: ProviderCredentialId): ProviderCredentialRef => ({
        provider: "D4H",
        credentialId,
        organizationId: T.org,
        userId: null,
    });

    const personalRef = (credentialId: ProviderCredentialId): ProviderCredentialRef => ({
        provider: "D4H",
        credentialId,
        organizationId: T.org,
        userId: T.user,
    });

    it("returns an organization credential for an organization ref, decrypted", async () => {
        const credential = await getProviderCredentialForOwner(orgRef(T.orgCredential));

        expect(credential?.id).toBe(T.orgCredential);
        expect(credential?.token).toBe("secret");
    });

    it("returns a personal credential for its own user's ref, decrypted", async () => {
        const credential = await getProviderCredentialForOwner(personalRef(T.personalCredential));

        expect(credential?.id).toBe(T.personalCredential);
        expect(credential?.token).toBe("secret");
    });

    it.each([
        {
            name: "a wrong provider",
            // D4H is the only provider today, so a mismatch needs a value outside the enum.
            ref: { ...orgRef(T.orgCredential), provider: "OTHER" as Provider },
        },
        {
            name: "a wrong organization",
            ref: { ...orgRef(T.orgCredential), organizationId: T.otherOrg },
        },
        { name: "a group-owned row", ref: orgRef(T.groupCredential) },
        { name: "an organization ref to a personal row", ref: orgRef(T.personalCredential) },
        { name: "a personal ref to an organization row", ref: personalRef(T.orgCredential) },
        {
            name: "a personal ref to another user's personal row",
            ref: personalRef(T.otherUserCredential),
        },
        { name: "a missing row", ref: orgRef(ProviderCredentialId.create()) },
    ])("returns null for $name", async ({ ref }) => {
        expect(await getProviderCredentialForOwner(ref)).toBeNull();
    });
});

describe("revalidateProviderCredential", () => {
    it("expires the exact tag the cached lookup is stored under, immediately", async () => {
        const credentialId = ProviderCredentialId.create();

        await getOrganizationProviderCredential({
            provider: "D4H",
            organizationId: OrganizationId.create(),
            credentialId,
        });
        const [tag] = vi.mocked(cacheTag).mock.lastCall!;

        revalidateProviderCredential(credentialId);

        // `expire: 0`: the next read is a blocking cache miss, so a deleted credential stops
        // working on the next request rather than after the stale window.
        expect(revalidateTag).toHaveBeenCalledWith(tag, { expire: 0 });
    });
});
