/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type { Permissions } from "@/lib/permissions";
import { D4HTaskId } from "@/lib/schemas/d4h-task";
import { FormInstanceId, FormInstanceItemId } from "@/lib/schemas/form-instance";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { formsRouter } from "./forms-router";

// `organizationProcedure` always folds in `organization: ["view"]`, and the mock's
// `hasPermission` checks statements literally.
const MEMBER: Permissions = { organization: ["view"] };

const FORM_KEY = "test-form";

describe("formsRouter: draft-only mutations", () => {
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        otherUser: UserId.create(),
        draft: FormInstanceId.create(),
        draftToDelete: FormInstanceId.create(),
        processed: FormInstanceId.create(),
        othersDraft: FormInstanceId.create(),
        draftItem: FormInstanceItemId.create(),
        processedItem: FormInstanceItemId.create(),
        othersItem: FormInstanceItemId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: T.org, slug: T.org, createdAt: new Date() },
        });
        for (const id of [T.user, T.otherUser]) {
            await db.user.create({ data: { id, name: id, email: `${id}@example.com` } });
        }

        const instances = [
            { id: T.draft, userId: T.user, formStatus: "Draft" },
            { id: T.draftToDelete, userId: T.user, formStatus: "Draft" },
            { id: T.processed, userId: T.user, formStatus: "Processed" },
            { id: T.othersDraft, userId: T.otherUser, formStatus: "Draft" },
        ];
        for (const instance of instances) {
            await db.formInstance.create({
                data: { ...instance, formKey: FORM_KEY, organizationId: T.org, formData: {} },
            });
        }

        const items = [
            { id: T.draftItem, formInstanceId: T.draft },
            { id: T.processedItem, formInstanceId: T.processed },
            { id: T.othersItem, formInstanceId: T.othersDraft },
        ];
        for (const item of items) {
            await db.formInstanceItem.create({
                data: { ...item, collectionKey: "items", formData: { original: true } },
            });
        }
    });

    function makeCaller(userId: UserId = T.user) {
        return formsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: userId },
                permissions: MEMBER,
                prisma: db,
            }),
        );
    }

    describe("deleteFormInstance", () => {
        it("deletes the caller's draft", async () => {
            await makeCaller().deleteFormInstance({
                organizationId: T.org,
                formInstanceId: T.draftToDelete,
                formKey: FORM_KEY,
            });

            expect(await db.formInstance.findUnique({ where: { id: T.draftToDelete } })).toBeNull();
        });

        it("throws NOT_FOUND for a processed instance, leaving it in place", async () => {
            await expect(
                makeCaller().deleteFormInstance({
                    organizationId: T.org,
                    formInstanceId: T.processed,
                    formKey: FORM_KEY,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });

            expect(await db.formInstance.findUnique({ where: { id: T.processed } })).not.toBeNull();
        });
    });

    describe("listFormInstanceItems", () => {
        it("lists the items of the caller's own instance", async () => {
            const items = await makeCaller().listFormInstanceItems({
                organizationId: T.org,
                formInstanceId: T.processed,
            });

            expect(items.map((item) => item.id)).toEqual([T.processedItem]);
        });

        it("returns nothing for another user's instance", async () => {
            const items = await makeCaller().listFormInstanceItems({
                organizationId: T.org,
                formInstanceId: T.othersDraft,
            });

            expect(items).toEqual([]);
        });
    });

    describe("saveFormInstanceItemData", () => {
        it("saves an item on the caller's draft", async () => {
            const item = await makeCaller().saveFormInstanceItemData({
                organizationId: T.org,
                formInstanceId: T.draft,
                formInstanceItemId: T.draftItem,
                parentItemId: null,
                collectionKey: "items",
                formData: { updated: true },
            });

            expect(item.formData).toEqual({ updated: true });
        });

        it("throws NOT_FOUND for a processed instance, leaving its item untouched", async () => {
            await expect(
                makeCaller().saveFormInstanceItemData({
                    organizationId: T.org,
                    formInstanceId: T.processed,
                    formInstanceItemId: T.processedItem,
                    parentItemId: null,
                    collectionKey: "items",
                    formData: { updated: true },
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });

            const item = await db.formInstanceItem.findUniqueOrThrow({
                where: { id: T.processedItem },
            });
            expect(item.formData).toEqual({ original: true });
        });

        it("throws NOT_FOUND for another instance's item on the caller's draft, leaving it untouched", async () => {
            await expect(
                makeCaller().saveFormInstanceItemData({
                    organizationId: T.org,
                    formInstanceId: T.draft,
                    formInstanceItemId: T.processedItem,
                    parentItemId: null,
                    collectionKey: "items",
                    formData: { updated: true },
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });

            const item = await db.formInstanceItem.findUniqueOrThrow({
                where: { id: T.processedItem },
            });
            expect(item.formInstanceId).toBe(T.processed);
            expect(item.formData).toEqual({ original: true });
        });
    });

    describe("deleteFormInstanceItem", () => {
        it("throws NOT_FOUND for a processed instance's item, leaving it in place", async () => {
            await expect(
                makeCaller().deleteFormInstanceItem({
                    organizationId: T.org,
                    formInstanceId: T.processed,
                    formInstanceItemId: T.processedItem,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });

            expect(
                await db.formInstanceItem.findUnique({ where: { id: T.processedItem } }),
            ).not.toBeNull();
        });

        it("throws NOT_FOUND for another user's draft item, leaving it in place", async () => {
            await expect(
                makeCaller().deleteFormInstanceItem({
                    organizationId: T.org,
                    formInstanceId: T.othersDraft,
                    formInstanceItemId: T.othersItem,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });

            expect(
                await db.formInstanceItem.findUnique({ where: { id: T.othersItem } }),
            ).not.toBeNull();
        });

        it("deletes an item from the caller's draft", async () => {
            await makeCaller().deleteFormInstanceItem({
                organizationId: T.org,
                formInstanceId: T.draft,
                formInstanceItemId: T.draftItem,
            });

            expect(await db.formInstanceItem.findUnique({ where: { id: T.draftItem } })).toBeNull();
        });
    });
});

describe("formsRouter: submitted form reads", () => {
    const TASK_VIEWER: Permissions = { organization: ["view"], d4hTask: ["view"] };

    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        otherUser: UserId.create(),
        draft: FormInstanceId.create(),
        older: FormInstanceId.create(),
        newer: FormInstanceId.create(),
        othersSubmitted: FormInstanceId.create(),
        otherOrgSubmitted: FormInstanceId.create(),
        firstTask: D4HTaskId.create(),
        secondTask: D4HTaskId.create(),
        otherInstanceTask: D4HTaskId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        for (const id of [T.user, T.otherUser]) {
            await db.user.create({ data: { id, name: id, email: `${id}@example.com` } });
        }

        const instances = [
            { id: T.draft, formStatus: "Draft", updatedAt: "2026-11-10T00:00:00Z" },
            { id: T.older, formStatus: "Processed", updatedAt: "2026-11-01T00:00:00Z" },
            { id: T.newer, formStatus: "Processed", updatedAt: "2026-11-02T00:00:00Z" },
            {
                id: T.othersSubmitted,
                userId: T.otherUser,
                formStatus: "Processed",
                updatedAt: "2026-11-03T00:00:00Z",
            },
            {
                id: T.otherOrgSubmitted,
                organizationId: T.otherOrg,
                formStatus: "Processed",
                updatedAt: "2026-11-04T00:00:00Z",
            },
        ];
        for (const { updatedAt, ...instance } of instances) {
            await db.formInstance.create({
                data: {
                    formKey: FORM_KEY,
                    organizationId: T.org,
                    userId: T.user,
                    formData: {},
                    ...instance,
                    updatedAt: new Date(updatedAt),
                },
            });
        }

        const tasks = [
            {
                id: T.secondTask,
                formInstanceId: T.newer,
                resourceId: 2,
                status: "Done",
                requestedAt: "2026-11-02T00:00:02Z",
            },
            {
                id: T.firstTask,
                formInstanceId: T.newer,
                resourceId: 1,
                status: "Open",
                requestedAt: "2026-11-02T00:00:01Z",
            },
            {
                id: T.otherInstanceTask,
                formInstanceId: T.othersSubmitted,
                resourceId: 3,
                status: "Open",
                requestedAt: "2026-11-03T00:00:01Z",
            },
        ];
        for (const { requestedAt, resourceId, ...task } of tasks) {
            await db.d4HTask.create({
                data: {
                    ...task,
                    organizationId: T.org,
                    d4hTeamId: 101,
                    resourceType: "Equipment",
                    resourceId,
                    itemLabel: `#${resourceId} Helmet`,
                    kind: "Retire",
                    payload: { reason: "Returned To Cache" },
                    applyMethod: "Manual",
                    requestedById: T.user,
                    requestedAt: new Date(requestedAt),
                },
            });
        }
    });

    function makeCaller(userId: UserId = T.user, permissions: Permissions = TASK_VIEWER) {
        return formsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: userId }, permissions, prisma: db }),
        );
    }

    describe("getFormInstance", () => {
        it("returns the caller's processed instance", async () => {
            const instance = await makeCaller().getFormInstance({
                organizationId: T.org,
                formInstanceId: T.newer,
                formKey: FORM_KEY,
            });

            expect(instance.id).toBe(T.newer);
            expect(instance.formStatus).toBe("Processed");
        });

        it("returns the caller's draft", async () => {
            const instance = await makeCaller().getFormInstance({
                organizationId: T.org,
                formInstanceId: T.draft,
                formKey: FORM_KEY,
            });

            expect(instance.formStatus).toBe("Draft");
        });

        it.each([
            ["another user's instance", T.othersSubmitted, FORM_KEY],
            ["another organization's instance", T.otherOrgSubmitted, FORM_KEY],
            ["a formKey mismatch", T.newer, "other-form"],
            ["an unknown id", FormInstanceId.create(), FORM_KEY],
        ])("throws NOT_FOUND for %s", async (_, formInstanceId, formKey) => {
            await expect(
                makeCaller().getFormInstance({ organizationId: T.org, formInstanceId, formKey }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });
    });

    describe("listSubmittedFormInstances", () => {
        it("lists the caller's own non-draft instances, newest first", async () => {
            const page = await makeCaller().listSubmittedFormInstances({
                organizationId: T.org,
                formKey: FORM_KEY,
            });

            expect(page.items.map((item) => item.id)).toEqual([T.newer, T.older]);
            expect(page.nextCursor).toBeNull();
        });

        it("pages through with nextCursor", async () => {
            const first = await makeCaller().listSubmittedFormInstances({
                organizationId: T.org,
                formKey: FORM_KEY,
                limit: 1,
            });
            expect(first.items.map((item) => item.id)).toEqual([T.newer]);
            expect(first.nextCursor).toBe(T.newer);

            const second = await makeCaller().listSubmittedFormInstances({
                organizationId: T.org,
                formKey: FORM_KEY,
                cursor: T.newer,
                limit: 1,
            });
            expect(second.items.map((item) => item.id)).toEqual([T.older]);
            expect(second.nextCursor).toBeNull();
        });
    });

    describe("listFormInstanceTasks", () => {
        it("lists the tasks the caller's instance queued, oldest first, in any status", async () => {
            const tasks = await makeCaller().listFormInstanceTasks({
                organizationId: T.org,
                formInstanceId: T.newer,
            });

            expect(tasks.map((task) => [task.id, task.status])).toEqual([
                [T.firstTask, "Open"],
                [T.secondTask, "Done"],
            ]);
        });

        it("throws NOT_FOUND for another user's instance", async () => {
            await expect(
                makeCaller().listFormInstanceTasks({
                    organizationId: T.org,
                    formInstanceId: T.othersSubmitted,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        it("throws NOT_FOUND for another organization's instance", async () => {
            await expect(
                makeCaller().listFormInstanceTasks({
                    organizationId: T.org,
                    formInstanceId: T.otherOrgSubmitted,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        it("throws FORBIDDEN without d4hTask view", async () => {
            await expect(
                makeCaller(T.user, MEMBER).listFormInstanceTasks({
                    organizationId: T.org,
                    formInstanceId: T.newer,
                }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });
    });
});
