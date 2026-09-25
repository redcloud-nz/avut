/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import { createSession, nextSessionNumber, requireSession } from "./skill-checks";

// The service reaches server-only modules at import time. The functions exercised here use an
// injected prisma client, so an empty stub is enough to let it import in jsdom.
vi.mock("server-only", () => ({}));

describe("skill-checks", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        session: SkillCheckSessionId.create(),
        outsiderSession: SkillCheckSessionId.create(),
        user: UserId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        await db.skillCheckSession.create({
            data: {
                id: T.session,
                organizationId: T.org,
                name: "Session One",
                sessionNumber: 1,
                startsAt: new Date("2026-01-01T00:00:00.000Z"),
                notes: "",
            },
        });
        await db.skillCheckSession.create({
            data: {
                id: T.outsiderSession,
                organizationId: T.otherOrg,
                name: "Outsider Session",
                sessionNumber: 1,
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

    describe("requireSession", () => {
        it("returns the session when it exists in the organization", async () => {
            const session = await requireSession(ctx(), T.session);

            expect(session.id).toBe(T.session);
        });

        it("throws NotFoundError for a session that does not exist", async () => {
            await expect(requireSession(ctx(), SkillCheckSessionId.create())).rejects.toThrow(
                "not found",
            );
        });

        it("throws NotFoundError for a session belonging to another organization", async () => {
            await expect(requireSession(ctx(), T.outsiderSession)).rejects.toThrow(
                `SkillCheckSession(id=${T.outsiderSession}) not found.`,
            );
        });
    });

    describe("nextSessionNumber", () => {
        it("is one greater than the highest existing sessionNumber", async () => {
            expect(await nextSessionNumber(ctx())).toBe(2);
        });

        it("does not count another organization's sessions", async () => {
            const emptyOrg = OrganizationId.create();
            await db.organization.create({
                data: { id: emptyOrg, name: emptyOrg, slug: emptyOrg, createdAt: new Date() },
            });

            expect(
                await nextSessionNumber(
                    createOrganizationMockContext({
                        organizationId: emptyOrg,
                        user: { id: T.user },
                        permissions: {},
                        prisma: db,
                    }),
                ),
            ).toBe(1);
        });
    });

    describe("createSession", () => {
        it("assigns the next available session number", async () => {
            const created = await createSession(ctx(), (sessionNumber) => ({
                id: SkillCheckSessionId.create(),
                organizationId: T.org,
                name: "New Session",
                sessionNumber,
            }));

            expect(created.sessionNumber).toBe(2);
        });

        it("retries with the next number on a sessionNumber collision", async () => {
            // A concurrent create already took the number `nextSessionNumber` would report next
            // (3, since "New Session" above claimed 2) — createSession must recover from the
            // unique-constraint violation rather than surfacing it.
            await db.skillCheckSession.create({
                data: {
                    id: SkillCheckSessionId.create(),
                    organizationId: T.org,
                    name: "Raced In First",
                    sessionNumber: 3,
                },
            });

            const created = await createSession(ctx(), (sessionNumber) => ({
                id: SkillCheckSessionId.create(),
                organizationId: T.org,
                name: "Retried Session",
                sessionNumber,
            }));

            expect(created.sessionNumber).toBe(4);
        });
    });
});
