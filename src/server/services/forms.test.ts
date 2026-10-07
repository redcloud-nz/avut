/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { ConflictError } from "@/lib/errors";
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
});
