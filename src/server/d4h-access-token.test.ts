/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { NotConfiguredError } from "@/lib/errors";
import { OrganizationId } from "@/lib/schemas/organization";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";

import { resolveD4HCredential, type D4HCredentialRef } from "./d4h-access-token";

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

// d4h-access-token imports the settings cache, which reads through the real Prisma client.
vi.mock("./cache/organization-settings", () => ({ getOrganizationSettings: vi.fn() }));

describe("resolveD4HCredential", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        otherUser: UserId.create(),
        orgCredential: ProviderCredentialId.create(),
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

        const seed = (id: string, userId: string | null) =>
            prisma.providerCredential.create({
                data: {
                    id,
                    provider: "D4H",
                    organizationId: T.org,
                    userId,
                    groupId: null,
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
        await seed(T.personalCredential, T.user);
        await seed(T.otherUserCredential, T.otherUser);
    });

    const orgRef = (credentialId: ProviderCredentialId): D4HCredentialRef => ({
        credentialId,
        organizationId: T.org,
        userId: null,
    });

    const personalRef = (credentialId: ProviderCredentialId): D4HCredentialRef => ({
        credentialId,
        organizationId: T.org,
        userId: T.user,
    });

    it("resolves an organization ref to the organization's token, decrypted", async () => {
        const token = await resolveD4HCredential(orgRef(T.orgCredential));

        expect(token.id).toBe(T.orgCredential);
        expect(token.userId).toBeNull();
        expect(token.token).toBe("secret");
        expect(token.serverCode).toBe("us");
    });

    it("resolves a personal ref to its own user's token, decrypted", async () => {
        const token = await resolveD4HCredential(personalRef(T.personalCredential));

        expect(token.id).toBe(T.personalCredential);
        expect(token.userId).toBe(T.user);
        expect(token.token).toBe("secret");
    });

    it.each([
        {
            name: "a personal ref to another user's personal credential",
            ref: personalRef(T.otherUserCredential),
        },
        { name: "an organization ref to a personal credential", ref: orgRef(T.personalCredential) },
        {
            name: "a personal ref to the organization credential",
            ref: personalRef(T.orgCredential),
        },
        {
            name: "a wrong organization",
            ref: { ...orgRef(T.orgCredential), organizationId: T.otherOrg },
        },
        { name: "a missing credential", ref: orgRef(ProviderCredentialId.create()) },
    ])("throws NotConfiguredError for $name", async ({ ref }) => {
        await expect(resolveD4HCredential(ref)).rejects.toThrow(NotConfiguredError);
    });
});
