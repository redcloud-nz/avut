/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { I3TemplateId } from "@/lib/schemas/i3-template";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import { deleteRecord, getById, recover, requireById } from "./i3-templates";

// The service reaches server-only modules at import time. The functions exercised here use an
// injected prisma client, so an empty stub is enough to let it import in jsdom.
vi.mock("server-only", () => ({}));

describe("i3-templates", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        template: I3TemplateId.create(),
        outsider: I3TemplateId.create(),
        user: UserId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        await db.i3Template.create({
            data: {
                id: T.template,
                organizationId: T.org,
                name: "Helmet",
                description: "Head protection",
            },
        });
        await db.i3Template.create({
            data: {
                id: T.outsider,
                organizationId: T.otherOrg,
                name: "Boots",
                description: "Foot protection",
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

    describe("getById", () => {
        it("returns the template when it exists in the organization", async () => {
            const template = await getById(ctx(), T.template);

            expect(template?.id).toBe(T.template);
        });

        it("returns null for a template that does not exist", async () => {
            expect(await getById(ctx(), I3TemplateId.create())).toBeNull();
        });

        it("does not reach across organizations", async () => {
            expect(await getById(ctx(), T.outsider)).toBeNull();
        });
    });

    describe("requireById", () => {
        it("returns the template when it exists", async () => {
            const template = await requireById(ctx(), T.template);

            expect(template.id).toBe(T.template);
        });

        it("throws NotFoundError when the template does not exist in this organization", async () => {
            await expect(requireById(ctx(), T.outsider)).rejects.toThrow(
                `I3Template(id=${T.outsider}) not found.`,
            );
        });
    });

    describe("deleteRecord / recover", () => {
        const L = { template: I3TemplateId.create() };

        beforeAll(async () => {
            await db.i3Template.create({
                data: {
                    id: L.template,
                    organizationId: T.org,
                    name: "Lifecycle Template",
                    description: "",
                },
            });
        });

        it("recover no-ops on an Active template", async () => {
            const active = await requireById(ctx(), L.template);
            expect(active.status).toBe("Active");

            await expect(recover(ctx(), L.template)).resolves.toMatchObject({
                status: "Active",
            });
        });

        it("deleteRecord moves an Active template to Deleted and is idempotent", async () => {
            const deleted = await deleteRecord(ctx(), L.template);
            expect(deleted.status).toBe("Deleted");

            const entries = await db.logEntry.findMany({
                where: { objectType: "I3Template", objectId: L.template, action: "Delete" },
            });
            expect(entries).toHaveLength(1);

            // Idempotent — no second log entry.
            await deleteRecord(ctx(), L.template);
            expect(
                await db.logEntry.findMany({
                    where: { objectType: "I3Template", objectId: L.template, action: "Delete" },
                }),
            ).toHaveLength(1);
        });

        it("recover moves a Deleted template back to Active and is idempotent", async () => {
            const restored = await recover(ctx(), L.template);
            expect(restored.status).toBe("Active");

            const entries = await db.logEntry.findMany({
                where: { objectType: "I3Template", objectId: L.template, action: "Recover" },
            });
            expect(entries).toHaveLength(1);

            // Idempotent — no second log entry.
            await recover(ctx(), L.template);
            expect(
                await db.logEntry.findMany({
                    where: { objectType: "I3Template", objectId: L.template, action: "Recover" },
                }),
            ).toHaveLength(1);
        });

        it("deleteRecord throws NotFoundError for a template in another organization", async () => {
            await expect(deleteRecord(ctx(), T.outsider)).rejects.toThrow(
                `I3Template(id=${T.outsider}) not found.`,
            );
        });
    });
});
