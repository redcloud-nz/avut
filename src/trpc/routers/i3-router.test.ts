/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { OrganizationId } from "@/lib/schemas/organization";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { i3Router } from "./i3-router";

// i3-router reaches @/server/auth (via forms-router) at import time; the procedures under test
// only touch ctx.prisma, so stubbing server-only is enough to load the module under jsdom.
vi.mock("server-only", () => ({}));

describe("i3Router.getTemplate", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        template: I3TemplateId.create(),
        otherOrgTemplate: I3TemplateId.create(),
        user: nanoId16(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.otherOrg, name: "Other", slug: "other", createdAt: new Date() },
        });
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
                id: T.otherOrgTemplate,
                organizationId: T.otherOrg,
                name: "Boots",
                description: "Foot protection",
            },
        });
    });

    function makeCaller() {
        return i3Router.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                // `organizationProcedure` always folds in `organization: ["view"]`.
                permissions: { i3Template: ["view"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("returns the template", async () => {
        const template = await makeCaller().getTemplate({
            organizationId: T.org,
            templateId: T.template,
        });

        expect(template.id).toBe(T.template);
        expect(template.name).toBe("Helmet");
        expect(template.description).toBe("Head protection");
    });

    it("throws NOT_FOUND for an unknown template", async () => {
        await expect(
            makeCaller().getTemplate({ organizationId: T.org, templateId: I3TemplateId.create() }),
        ).rejects.toThrow(/not found/i);
    });

    // Organization scoping is the security boundary — a valid template id from another org
    // must not resolve.
    it("throws NOT_FOUND for a template in another organization", async () => {
        await expect(
            makeCaller().getTemplate({ organizationId: T.org, templateId: T.otherOrgTemplate }),
        ).rejects.toThrow(/not found/i);
    });
});

describe("i3Router.deleteTemplate / recoverTemplate", () => {
    const T = { org: OrganizationId.create(), user: nanoId16() };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
    });

    function makeCaller(perms: Record<string, string[]>) {
        return i3Router.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], ...perms },
                prisma: db,
            }),
        );
    }

    it("soft-deletes a template and records a Delete log entry", async () => {
        const { created } = await makeCaller({ i3Template: ["create"] }).createTemplate({
            organizationId: T.org,
            templateId: I3TemplateId.create(),
            create: { name: "Doomed", description: "", d4h: null },
        });

        await makeCaller({ i3Template: ["delete"] }).deleteTemplate({
            organizationId: T.org,
            templateId: created.id,
        });

        const row = await db.i3Template.findUnique({ where: { id: created.id } });
        expect(row).toMatchObject({ status: "Deleted" });
        const entries = await db.logEntry.findMany({
            where: { objectType: "I3Template", objectId: created.id, action: "Delete" },
        });
        expect(entries).toHaveLength(1);
    });

    it("deleteTemplate is idempotent — deleting an already-deleted template writes no new log entry", async () => {
        const { created } = await makeCaller({ i3Template: ["create"] }).createTemplate({
            organizationId: T.org,
            templateId: I3TemplateId.create(),
            create: { name: "Doomed Again", description: "", d4h: null },
        });

        await makeCaller({ i3Template: ["delete"] }).deleteTemplate({
            organizationId: T.org,
            templateId: created.id,
        });
        await makeCaller({ i3Template: ["delete"] }).deleteTemplate({
            organizationId: T.org,
            templateId: created.id,
        });

        const entries = await db.logEntry.findMany({
            where: { objectType: "I3Template", objectId: created.id, action: "Delete" },
        });
        expect(entries).toHaveLength(1);
    });

    it("deleteTemplate throws NOT_FOUND for an unknown template", async () => {
        await expect(
            makeCaller({ i3Template: ["delete"] }).deleteTemplate({
                organizationId: T.org,
                templateId: I3TemplateId.create(),
            }),
        ).rejects.toThrow(/not found/i);
    });

    it("recoverTemplate requires i3Template:delete, not i3Template:update", async () => {
        const { created } = await makeCaller({ i3Template: ["create"] }).createTemplate({
            organizationId: T.org,
            templateId: I3TemplateId.create(),
            create: { name: "Gated", description: "", d4h: null },
        });
        await makeCaller({ i3Template: ["delete"] }).deleteTemplate({
            organizationId: T.org,
            templateId: created.id,
        });

        await expect(
            makeCaller({ i3Template: ["update"] }).recoverTemplate({
                organizationId: T.org,
                templateId: created.id,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("recovers a deleted template back to Active and records a Recover log entry", async () => {
        const { created } = await makeCaller({ i3Template: ["create"] }).createTemplate({
            organizationId: T.org,
            templateId: I3TemplateId.create(),
            create: { name: "Recoverable", description: "", d4h: null },
        });
        await makeCaller({ i3Template: ["delete"] }).deleteTemplate({
            organizationId: T.org,
            templateId: created.id,
        });

        const { updated } = await makeCaller({ i3Template: ["delete"] }).recoverTemplate({
            organizationId: T.org,
            templateId: created.id,
        });
        expect(updated.status).toBe("Active");

        const entries = await db.logEntry.findMany({
            where: { objectType: "I3Template", objectId: created.id, action: "Recover" },
        });
        expect(entries).toHaveLength(1);
    });
});

describe("i3Router.listTemplates", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        active: I3TemplateId.create(),
        deleted: I3TemplateId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.i3Template.create({
            data: {
                id: T.active,
                organizationId: T.org,
                name: "Active Template",
                description: "",
                status: "Active",
            },
        });
        await db.i3Template.create({
            data: {
                id: T.deleted,
                organizationId: T.org,
                name: "Deleted Template",
                description: "",
                status: "Deleted",
            },
        });
    });

    function makeCaller() {
        return i3Router.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], i3Template: ["view"] },
                prisma: db,
            }),
        );
    }

    it("excludes Deleted templates", async () => {
        const templates = await makeCaller().listTemplates({ organizationId: T.org });
        const ids = templates.map((t) => t.id);

        expect(ids).toContain(T.active);
        expect(ids).not.toContain(T.deleted);
    });
});
