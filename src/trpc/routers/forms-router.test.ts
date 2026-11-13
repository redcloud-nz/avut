/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type { Permissions } from "@/lib/permissions";
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
