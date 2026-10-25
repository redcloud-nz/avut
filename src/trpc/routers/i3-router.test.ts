/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { I3IssueItemsFormProcessor } from "@/forms/i3-issue-items/processor";
import { I3ReturnItemsFormProcessor } from "@/forms/i3-return-items/processor";
import type { I3ReturnItemsFormData } from "@/forms/i3-return-items/schema";
import { ForbiddenError } from "@/lib/errors";
import { nanoId16 } from "@/lib/id";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { fetchD4HWhoami, getD4HTokenMetadata } from "@/server/d4h-api/client";
import { fetchD4HEquipmentItem, fetchD4HTeamEquipmentCatalogue } from "@/server/d4h-api/equipment";
import { sendEmail } from "@/server/email";
import { createRetireTask } from "@/server/services/d4h-tasks";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext, createOrganizationMockContext } from "@/test/trpc-helpers";

import { i3Router } from "./i3-router";

// i3-router reaches @/server/auth (via forms-router) at import time; the procedures under test
// only touch ctx.prisma, so stubbing server-only is enough to load the module under jsdom.
vi.mock("server-only", () => ({}));

// submitIssueItemsForm's test drives the router's error handling with canned stage results.
vi.mock("@/forms/i3-issue-items/processor", () => ({
    I3IssueItemsFormProcessor: { execute: vi.fn() },
}));

// submitReturnItemsForm's tests check what the router hands the processor and what it returns.
vi.mock("@/forms/i3-return-items/processor", () => ({
    I3ReturnItemsFormProcessor: { executeWithOutput: vi.fn() },
}));

// returnItem's tests run the real `returnItems` against canned D4H responses.
const GET = vi.hoisted(() => vi.fn());

vi.mock("@/server/d4h-access-token", () => ({
    getConfiguredD4HAccessToken: vi.fn(async () => ({
        id: "token-1",
        serverCode: "ap",
        token: "secret",
    })),
    toD4HCredentialRef: vi.fn(() => ({ credentialId: "token-1" })),
}));

vi.mock("@/server/d4h-api/client", () => ({
    fetchD4HWhoami: vi.fn(),
    getD4HFetchClient: vi.fn(() => ({ GET })),
    getD4HTeamMembers: vi.fn(async () => [{ id: 42, name: "John Smith" }]),
    getD4HTokenMetadata: vi.fn(),
}));

vi.mock("@/server/d4h-api/equipment", () => ({
    fetchD4HEquipmentItem: vi.fn(),
    fetchD4HTeamEquipmentCatalogue: vi.fn(),
}));

// Mocked only so the returnItem tests can assert it never sends.
vi.mock("@/server/email", () => ({
    NoReplyEmailAddress: "no-reply@example.test",
    sendEmail: vi.fn(async () => {}),
}));

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

describe("i3Router.listTemplateFits", () => {
    const T = { org: OrganizationId.create(), user: nanoId16(), template: I3TemplateId.create() };
    const organisation = { resourceType: "Organisation" as const, id: 100, title: "Org" };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.i3Template.create({
            data: {
                id: T.template,
                organizationId: T.org,
                name: "Hi-vis vest",
                description: "",
                d4h: {
                    create: {
                        categoryId: 10,
                        categoryTitle: "Clothing",
                        kindId: 20,
                        kindTitle: "Vest",
                        outputRefFormat: "",
                        requireSN: false,
                    },
                },
            },
        });

        vi.mocked(getD4HTokenMetadata).mockResolvedValue({
            d4HTeams: [
                {
                    id: 1,
                    title: "Team 1",
                    resourceType: "Team",
                    owner: organisation,
                    permissions: {},
                },
            ],
            d4HOrganisations: [organisation],
        } as unknown as Awaited<ReturnType<typeof getD4HTokenMetadata>>);
        vi.mocked(fetchD4HTeamEquipmentCatalogue).mockResolvedValue({
            categories: [{ id: 10, title: "Clothing", owner: organisation }],
            kinds: [{ id: 20, title: "Vest", owner: organisation }],
            brands: [],
            models: [],
        } as unknown as Awaited<ReturnType<typeof fetchD4HTeamEquipmentCatalogue>>);
    });

    function makeCaller(
        permissions: Parameters<typeof createAuthenticatedMockContext>[0]["permissions"],
    ) {
        return i3Router.createCaller(
            createAuthenticatedMockContext({ user: { id: T.user }, permissions, prisma: db }),
        );
    }

    it("needs i3Item issue permission", async () => {
        await expect(
            makeCaller({ organization: ["view"], i3Item: ["view"] }).listTemplateFits({
                organizationId: T.org,
                teamId: 1,
            }),
        ).rejects.toThrow("Insufficient permissions");
    });

    it("returns the ids of the templates that fit the team", async () => {
        const fits = await makeCaller({
            organization: ["view"],
            i3Item: ["issue"],
        }).listTemplateFits({ organizationId: T.org, teamId: 1 });

        expect(fits).toEqual({ templateIds: [T.template], variantIds: [] });
    });
});

describe("i3Router.submitIssueItemsForm", () => {
    const T = { org: OrganizationId.create(), user: nanoId16(), template: I3TemplateId.create() };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
    });

    function makeCaller() {
        return i3Router.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], i3Item: ["issue"] },
                prisma: db,
            }),
        );
    }

    // The router wraps the first stage error as the `cause` of an INTERNAL_SERVER_ERROR, and
    // `mapDomainErrors` unwraps a domain cause, so the client sees FORBIDDEN, not a 500.
    it("surfaces a stage ForbiddenError as FORBIDDEN with its message", async () => {
        const message = "You need D4H's Equipment CREATE permission on Team to do this.";
        vi.mocked(I3IssueItemsFormProcessor.execute).mockResolvedValue([
            { stageName: "CheckD4HAccessToken", status: "success", duration: 0 },
            {
                stageName: "CheckPermissions",
                status: "error",
                error: new ForbiddenError(message),
                duration: 0,
            },
        ]);

        await expect(
            makeCaller().submitIssueItemsForm({
                organizationId: T.org,
                formInstanceId: FormInstanceId.create(),
                formData: {
                    recipient: { id: 42, teamId: 7, name: "John Smith" },
                    items: [
                        {
                            template: { id: T.template, name: "Helmet" },
                            variant: null,
                            serialNumber: null,
                        },
                    ],
                    comments: "",
                },
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN", message });
    });
});

describe("i3Router.submitReturnItemsForm", () => {
    const T = { org: OrganizationId.create(), user: nanoId16() };
    const db = createMockPrisma();

    const formData: I3ReturnItemsFormData = {
        recipient: { id: 42, teamId: 7, name: "John Smith" },
        items: [{ itemId: 1234, ref: "1234", kindTitle: "Helmet" }],
        comments: "Cracked shell",
    };

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
    });

    function makeCaller(i3Item: ("issue" | "return")[] = ["return"]) {
        return i3Router.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], i3Item },
                prisma: db,
            }),
        );
    }

    it("throws FORBIDDEN without i3Item:return", async () => {
        await expect(
            makeCaller(["issue"]).submitReturnItemsForm({
                organizationId: T.org,
                formInstanceId: FormInstanceId.create(),
                formData,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("runs the processor on the saved data and returns only its counts", async () => {
        const failures = ["#99 Boots: not held by John Smith"];
        vi.mocked(I3ReturnItemsFormProcessor.executeWithOutput).mockResolvedValue({
            results: [{ stageName: "ReturnItems", status: "success", duration: 0 }],
            output: {
                accessToken: { secret: "do-not-leak" },
                returned: 1,
                failures,
                returnedItems: formData.items,
            },
        } as unknown as Awaited<ReturnType<typeof I3ReturnItemsFormProcessor.executeWithOutput>>);

        const formInstanceId = FormInstanceId.create();
        const result = await makeCaller().submitReturnItemsForm({
            organizationId: T.org,
            formInstanceId,
            formData,
        });

        expect(result).toEqual({ returned: 1, failures });
        expect(I3ReturnItemsFormProcessor.executeWithOutput).toHaveBeenCalledWith(
            formInstanceId,
            formData,
            expect.objectContaining({ organizationId: T.org }),
        );

        const saved = await db.formInstance.findUnique({ where: { id: formInstanceId } });
        expect(saved).toMatchObject({ formKey: "i3-return", formData });
    });
});

describe("i3Router.returnItem", () => {
    const TEAM_ID = 7;
    const ITEM_ID = 1234;
    const T = { org: OrganizationId.create(), user: UserId.create() };

    let db: ReturnType<typeof createMockPrisma>;

    /** A whoami for a member of `TEAM_ID`, with or without `Equipment.UPDATE`. */
    function whoami(canUpdate: boolean) {
        return {
            account: { id: 1, resourceType: "Account" },
            members: [
                {
                    id: 11,
                    resourceType: "Member",
                    hasAccess: true,
                    name: "Receiver",
                    owner: { id: TEAM_ID, resourceType: "Team", title: "Rescue Team" },
                    permissions: { Equipment: { UPDATE: canUpdate } },
                },
            ],
        } as never;
    }

    /** The item as `fetchD4HEquipmentItem` returns it, held by member 42 unless overridden. */
    function item(overrides: Record<string, unknown> = {}) {
        return {
            id: ITEM_ID,
            ref: "001234",
            status: "OPERATIONAL",
            serial: null,
            owner: { resourceType: "Team", id: TEAM_ID },
            category: { resourceType: "EquipmentCategory", id: 3 },
            kind: { resourceType: "EquipmentKind", id: 8, title: "Helmet" },
            brand: { resourceType: "EquipmentBrand", id: null },
            model: null,
            notes: "",
            parents: [],
            dateExpires: null,
            dateFirstUse: null,
            dateManufactured: null,
            datePurchased: null,
            dateRetired: null,
            dateWarranty: null,
            isCritical: false,
            isMonitor: false,
            barcode: null,
            retiredReason: null,
            location: { resourceType: "Member", id: 42 },
            ...overrides,
        } as never;
    }

    beforeEach(async () => {
        // A fresh database per test: each asserts on the tasks it alone created.
        db = createMockPrisma();
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.user.create({
            data: { id: T.user, name: "Receiver", email: "receiver@example.com" },
        });

        vi.mocked(fetchD4HWhoami).mockResolvedValue(whoami(true));
        vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(item());
        GET.mockReset();
        GET.mockResolvedValue({
            data: { results: [{ id: ITEM_ID }], page: 0, pageSize: 1 },
            response: new Response(null, { status: 200 }),
        });
    });

    function makeCaller(i3Item: ("issue" | "return")[] = ["return"]) {
        return i3Router.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user, name: "Receiver", email: "receiver@example.com" },
                permissions: { organization: ["view"], i3Item },
                prisma: db,
            }),
        );
    }

    const input = (comments = "") => ({
        organizationId: T.org,
        teamId: TEAM_ID,
        itemId: ITEM_ID,
        comments,
    });

    it("queues a retire task with the note, and sends no email", async () => {
        const result = await makeCaller().returnItem(input("Strap frayed."));

        expect(result).toEqual({ returned: 1, failures: [] });
        expect(await db.d4HTask.findMany()).toMatchObject([
            {
                d4hTeamId: TEAM_ID,
                resourceId: ITEM_ID,
                itemLabel: "#001234 Helmet",
                status: "Open",
                payload: {
                    reason: "Returned To Cache",
                    note: "Returned via AVUT, received by Receiver. Strap frayed.",
                },
                formInstanceId: null,
            },
        ]);
        expect(await db.logBatch.findMany()).toMatchObject([
            { operationKey: "i3-return-items", description: "Returned items from John Smith" },
        ]);
        expect(sendEmail).not.toHaveBeenCalled();
    });

    it("throws FORBIDDEN without i3Item:return", async () => {
        await expect(makeCaller(["issue"]).returnItem(input())).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
    });

    it("throws FORBIDDEN without D4H's Equipment UPDATE on the team", async () => {
        vi.mocked(fetchD4HWhoami).mockResolvedValue(whoami(false));

        await expect(makeCaller().returnItem(input())).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
        expect(fetchD4HEquipmentItem).not.toHaveBeenCalled();
        expect(await db.d4HTask.findMany()).toEqual([]);
    });

    it("throws NOT_FOUND for an item owned by another team", async () => {
        vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(
            item({ owner: { resourceType: "Team", id: 99 } }),
        );

        await expect(makeCaller().returnItem(input())).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
    });

    it("refuses an item that isn't issued to a person", async () => {
        vi.mocked(fetchD4HEquipmentItem).mockResolvedValue(
            item({ location: { resourceType: "EquipmentLocation", id: 5 } }),
        );

        await expect(makeCaller().returnItem(input())).rejects.toMatchObject({
            code: "BAD_REQUEST",
            message: "This item isn't issued to a person.",
        });
        expect(await db.d4HTask.findMany()).toEqual([]);
    });

    it("reports an item that already has an open retire task as a failure", async () => {
        await createRetireTask(
            createOrganizationMockContext({
                organizationId: T.org,
                user: { id: T.user },
                prisma: db,
            }),
            { d4hTeamId: TEAM_ID, itemId: ITEM_ID, itemLabel: "#001234 Helmet", reason: "Lost" },
        );

        const result = await makeCaller().returnItem(input());

        expect(result).toEqual({
            returned: 0,
            failures: ["#001234 Helmet: already has an open retire task"],
        });
        expect(await db.d4HTask.findMany()).toHaveLength(1);
    });
});
