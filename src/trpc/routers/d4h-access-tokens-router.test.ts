/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

// d4h-access-tokens-router reaches @/server/auth at import time via ../init. It also imports
// @/server/d4h-api/client and @/server/d4h-access-token, both of which pull in next/cache and
// are not exercised by these tests (they cover the audit-log redaction, not live D4H calls or
// encryption) — stub them out so the module loads under jsdom and never makes a network call.
vi.mock("server-only", () => ({}));

vi.mock("@/server/d4h-api/client", () => ({
    getD4HFetchClient: vi.fn(() => ({
        GET: vi.fn(async () => ({ data: undefined, response: { statusText: "OK" } })),
    })),
    getD4HTokenMetadata: vi.fn(async () => ({ d4HTeams: [], d4HOrganisations: [] })),
}));

vi.mock("@/server/d4h-access-token", () => ({
    revalidatePersonalD4HAccessTokenForUser: vi.fn(),
}));

vi.mock("@/server/encrypt", () => ({
    encryptDBValue: (value: string) => `encrypted:${value}`,
    decryptDBValue: (value: string) => value.replace(/^encrypted:/, ""),
}));

import { nanoId16 } from "@/lib/id";
import { D4HServerCode } from "@/lib/d4h-servers";
import { OrganizationId } from "@/lib/schemas/organization";
import { D4HAccessTokenId } from "@/lib/schemas/d4h-access-token";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { d4hAccessTokensRouter } from "./d4h-access-tokens-router";

describe("d4hAccessTokensRouter.createOrganizationAccessToken", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
    });

    function makeCaller() {
        return d4hAccessTokensRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { d4hAccessToken: ["create"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("never records the raw token in the audit log", async () => {
        const tokenId = D4HAccessTokenId.create();

        // prisma-mock stores DateTime fields verbatim instead of coercing a written ISO
        // string to a Date the way real Prisma does, so `D4HAccessToken.fromRecord`'s
        // `record.expiresAt.toISOString()` can throw once the mutation reaches its output
        // shaping — after the $transaction (token create + logEvent) has already
        // committed. That's an unrelated mock limitation, not part of the behaviour under
        // test, so it's swallowed here; what we assert on is what was actually written.
        try {
            await makeCaller().createOrganizationAccessToken({
                organizationId: T.org,
                tokenId,
                create: {
                    serverCode: "us" as D4HServerCode,
                    label: "Test token",
                    token: "super-secret-d4h-key",
                },
            });
        } catch (err) {
            if (!(err instanceof Error) || !/toISOString/.test(err.message)) throw err;
        }

        const entries = await db.logEntry.findMany({
            where: { organizationId: T.org },
        });

        expect(entries).toHaveLength(1);
        const changes = entries[0].changes as unknown[];

        // The secret value must never appear anywhere in the recorded changes.
        expect(JSON.stringify(changes)).not.toContain("super-secret-d4h-key");

        // ...and the field is explicitly masked, not merely omitted.
        expect(changes).toContainEqual({ type: "obj_mask", path: ["token"] });

        // The rest of the create payload is still recorded normally.
        expect(changes).toContainEqual({
            type: "obj_add",
            path: ["label"],
            curr: "Test token",
        });

        // The token itself is still persisted (encrypted) on the record.
        const stored = await db.d4hAccessToken.findUniqueOrThrow({ where: { id: tokenId } });
        expect(stored.token).not.toBe("super-secret-d4h-key");
    });
});

describe("d4hAccessTokensRouter.createPersonalAccessToken", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
    });

    function makeCaller() {
        return d4hAccessTokensRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("never records the raw token in the audit log", async () => {
        const tokenId = D4HAccessTokenId.create();

        // See the comment in the sibling describe block above: prisma-mock's lack of
        // DateTime coercion can throw a mock-only error after the transaction commits.
        try {
            await makeCaller().createPersonalAccessToken({
                organizationId: T.org,
                tokenId,
                create: {
                    serverCode: "us" as D4HServerCode,
                    token: "another-super-secret-key",
                },
            });
        } catch (err) {
            if (!(err instanceof Error) || !/toISOString/.test(err.message)) throw err;
        }

        const entries = await db.logEntry.findMany({
            where: { organizationId: T.org },
        });

        expect(entries).toHaveLength(1);
        const changes = entries[0].changes as unknown[];

        expect(JSON.stringify(changes)).not.toContain("another-super-secret-key");
        expect(changes).toContainEqual({ type: "obj_mask", path: ["token"] });
    });
});
