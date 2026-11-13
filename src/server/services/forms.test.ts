/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { ConflictError, NotFoundError } from "@/lib/errors";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as Forms from "./forms";

describe("Forms.saveInstance", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        otherUser: UserId.create(),
        existing: FormInstanceId.create(),
        processed: FormInstanceId.create(),
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

        await db.formInstance.create({
            data: {
                id: T.existing,
                formKey: "test-form",
                organizationId: T.org,
                userId: T.user,
                formData: { a: 1 },
                formStatus: "Draft",
            },
        });
        await db.formInstance.create({
            data: {
                id: T.processed,
                formKey: "test-form",
                organizationId: T.org,
                userId: T.user,
                formData: { a: 1 },
                formStatus: "Processed",
            },
        });
    });

    function ctx(userId: UserId = T.user) {
        return createOrganizationMockContext({
            organizationId: T.org,
            user: { id: userId },
            permissions: {},
            prisma: db,
        });
    }

    it("creates a new form instance", async () => {
        const formInstanceId = FormInstanceId.create();

        const result = await Forms.saveInstance(ctx(), {
            formInstanceId,
            formKey: "new-form",
            formData: { hello: "world" },
        });

        expect(result.id).toBe(formInstanceId);
        expect(result.formData).toEqual({ hello: "world" });
        expect(result.formStatus).toBe("Draft");
    });

    it("updates an existing form instance belonging to the same user and organization", async () => {
        const result = await Forms.saveInstance(ctx(), {
            formInstanceId: T.existing,
            formKey: "test-form",
            formData: { a: 2 },
        });

        expect(result.formData).toEqual({ a: 2 });
    });

    it("throws ConflictError when the instance belongs to a different user", async () => {
        await expect(
            Forms.saveInstance(ctx(T.otherUser), {
                formInstanceId: T.existing,
                formKey: "test-form",
                formData: { a: 3 },
            }),
        ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when the instance belongs to a different organization", async () => {
        const otherOrgCtx = createOrganizationMockContext({
            organizationId: T.otherOrg,
            user: { id: T.user },
            permissions: {},
            prisma: db,
        });

        await expect(
            Forms.saveInstance(otherOrgCtx, {
                formInstanceId: T.existing,
                formKey: "test-form",
                formData: { a: 4 },
            }),
        ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when formKey doesn't match the existing instance", async () => {
        await expect(
            Forms.saveInstance(ctx(), {
                formInstanceId: T.existing,
                formKey: "wrong-key",
                formData: { a: 5 },
            }),
        ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when the instance isn't a draft, leaving it untouched", async () => {
        const before = await db.formInstance.findUniqueOrThrow({ where: { id: T.processed } });

        await expect(
            Forms.saveInstance(ctx(), {
                formInstanceId: T.processed,
                formKey: "test-form",
                formData: { a: 6 },
            }),
        ).rejects.toThrow(ConflictError);

        const after = await db.formInstance.findUniqueOrThrow({ where: { id: T.processed } });
        expect(after.formStatus).toBe("Processed");
        expect(after.formData).toEqual({ a: 1 });
        expect(after.updatedAt).toEqual(before.updatedAt);
    });

    it("throws ConflictError when a concurrent first save creates the instance first", async () => {
        // The read sees no instance; by the time of the create another save has made it.
        vi.spyOn(db.formInstance, "create").mockRejectedValueOnce(
            Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
        );

        await expect(
            Forms.saveInstance(ctx(), {
                formInstanceId: FormInstanceId.create(),
                formKey: "test-form",
                formData: { a: 8 },
            }),
        ).rejects.toThrow(ConflictError);
    });

    it("doesn't revert a status write that lands between its read and its write", async () => {
        const processed = await db.formInstance.findUniqueOrThrow({ where: { id: T.processed } });
        // The read still sees a draft; by the time of the write the processor has marked it.
        vi.spyOn(db.formInstance, "findUnique").mockResolvedValueOnce({
            ...processed,
            formStatus: "Draft",
        } as never);

        await expect(
            Forms.saveInstance(ctx(), {
                formInstanceId: T.processed,
                formKey: "test-form",
                formData: { a: 7 },
            }),
        ).rejects.toThrow(ConflictError);

        const after = await db.formInstance.findUniqueOrThrow({ where: { id: T.processed } });
        expect(after.formStatus).toBe("Processed");
        expect(after.formData).toEqual({ a: 1 });
    });
});

describe("Forms reads", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        otherUser: UserId.create(),
        draft: FormInstanceId.create(),
        oldest: FormInstanceId.create(),
        middle: FormInstanceId.create(),
        newest: FormInstanceId.create(),
        otherForm: FormInstanceId.create(),
        othersSubmitted: FormInstanceId.create(),
        otherOrgSubmitted: FormInstanceId.create(),
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
            { id: T.oldest, formStatus: "Processed", updatedAt: "2026-11-01T00:00:00Z" },
            { id: T.middle, formStatus: "Submitted", updatedAt: "2026-11-02T00:00:00Z" },
            { id: T.newest, formStatus: "Processed", updatedAt: "2026-11-03T00:00:00Z" },
            {
                id: T.otherForm,
                formKey: "other-form",
                formStatus: "Processed",
                updatedAt: "2026-11-04T00:00:00Z",
            },
            {
                id: T.othersSubmitted,
                userId: T.otherUser,
                formStatus: "Processed",
                updatedAt: "2026-11-05T00:00:00Z",
            },
            {
                id: T.otherOrgSubmitted,
                organizationId: T.otherOrg,
                formStatus: "Processed",
                updatedAt: "2026-11-06T00:00:00Z",
            },
        ];
        for (const { updatedAt, ...instance } of instances) {
            await db.formInstance.create({
                data: {
                    formKey: "test-form",
                    organizationId: T.org,
                    userId: T.user,
                    formData: {},
                    ...instance,
                    updatedAt: new Date(updatedAt),
                },
            });
        }
    });

    function ctx(userId: UserId = T.user, organizationId: OrganizationId = T.org) {
        return createOrganizationMockContext({
            organizationId,
            user: { id: userId },
            permissions: {},
            prisma: db,
        });
    }

    describe("requireInstanceById", () => {
        it("returns the caller's instance whatever its status", async () => {
            const draft = await Forms.requireInstanceById(ctx(), { formInstanceId: T.draft });
            const processed = await Forms.requireInstanceById(ctx(), {
                formInstanceId: T.newest,
                formKey: "test-form",
            });

            expect(draft.formStatus).toBe("Draft");
            expect(processed.formStatus).toBe("Processed");
        });

        it("throws NotFoundError for another user's instance", async () => {
            await expect(
                Forms.requireInstanceById(ctx(T.otherUser), { formInstanceId: T.newest }),
            ).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError for another organization's instance", async () => {
            await expect(
                Forms.requireInstanceById(ctx(T.user, T.otherOrg), { formInstanceId: T.newest }),
            ).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError for a formKey mismatch", async () => {
            await expect(
                Forms.requireInstanceById(ctx(), {
                    formInstanceId: T.newest,
                    formKey: "other-form",
                }),
            ).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError for an unknown id", async () => {
            await expect(
                Forms.requireInstanceById(ctx(), { formInstanceId: FormInstanceId.create() }),
            ).rejects.toThrow(NotFoundError);
        });
    });

    describe("listSubmittedInstances", () => {
        it("lists the caller's non-draft instances of the form in this organization, newest first", async () => {
            const page = await Forms.listSubmittedInstances(ctx(), {
                formKey: "test-form",
                limit: 20,
            });

            expect(page.items.map((item) => item.id)).toEqual([T.newest, T.middle, T.oldest]);
            expect(page.nextCursor).toBeNull();
        });

        it("pages with nextCursor, with no overlap and null at the end", async () => {
            const first = await Forms.listSubmittedInstances(ctx(), {
                formKey: "test-form",
                limit: 2,
            });
            expect(first.items.map((item) => item.id)).toEqual([T.newest, T.middle]);
            expect(first.nextCursor).toBe(T.middle);

            const second = await Forms.listSubmittedInstances(ctx(), {
                formKey: "test-form",
                cursor: T.middle,
                limit: 2,
            });
            expect(second.items.map((item) => item.id)).toEqual([T.oldest]);
            expect(second.nextCursor).toBeNull();
        });

        it("lists only another user's own submissions for them", async () => {
            const page = await Forms.listSubmittedInstances(ctx(T.otherUser), {
                formKey: "test-form",
                limit: 20,
            });

            expect(page.items.map((item) => item.id)).toEqual([T.othersSubmitted]);
        });

        it("lists only that organization's submissions in another organization", async () => {
            const page = await Forms.listSubmittedInstances(ctx(T.user, T.otherOrg), {
                formKey: "test-form",
                limit: 20,
            });

            expect(page.items.map((item) => item.id)).toEqual([T.otherOrgSubmitted]);
        });
    });
});
