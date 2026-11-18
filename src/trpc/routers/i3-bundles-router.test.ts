/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { I3BundleId } from "@/lib/schemas/i3-bundle";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { i3BundlesRouter } from "./i3-bundles-router";

describe("i3BundlesRouter", () => {
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        bundle: I3BundleId.create(),
        helmet: I3TemplateId.create(),
        boots: I3TemplateId.create(),
    };

    const db = createMockPrisma();

    // `organizationProcedure` always folds in `organization: ["view"]`.
    const Roles = {
        admin: { organization: ["view"], i3Bundle: ["view", "create", "update", "delete"] },
        editor: { organization: ["view"], i3Bundle: ["view"] },
        member: { organization: ["view"] },
    };

    function makeCaller(permissions: Record<string, string[]>) {
        return i3BundlesRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.user }, permissions, prisma: db }),
        );
    }

    async function createTemplate(id: I3TemplateId, name: string) {
        await db.i3Template.create({
            data: {
                id,
                organizationId: T.org,
                name,
                description: "",
                d4h: {
                    create: {
                        categoryId: 1,
                        categoryTitle: "PPE",
                        kindId: 10,
                        kindTitle: name,
                        outputRefFormat: "",
                        requireSN: false,
                    },
                },
            },
        });
    }

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await createTemplate(T.helmet, "Helmet");
        await createTemplate(T.boots, "Boots");
        await db.i3Bundle.create({
            data: { id: T.bundle, organizationId: T.org, name: "Recruit", description: "" },
        });
        await db.i3BundleItem.create({ data: { bundleId: T.bundle, templateId: T.helmet } });
    });

    describe("permission gate", () => {
        // Each procedure with a minimal valid input; none of these calls reaches the service
        // when the gate refuses it.
        const calls = {
            addTemplates: (c: ReturnType<typeof makeCaller>) =>
                c.addTemplates({
                    organizationId: T.org,
                    bundleId: T.bundle,
                    templateIds: [T.boots],
                }),
            createBundle: (c: ReturnType<typeof makeCaller>) =>
                c.createBundle({
                    organizationId: T.org,
                    bundleId: I3BundleId.create(),
                    create: { name: "Nope", description: "" },
                }),
            deleteBundle: (c: ReturnType<typeof makeCaller>) =>
                c.deleteBundle({ organizationId: T.org, bundleId: T.bundle }),
            recoverBundle: (c: ReturnType<typeof makeCaller>) =>
                c.recoverBundle({ organizationId: T.org, bundleId: T.bundle }),
            removeTemplate: (c: ReturnType<typeof makeCaller>) =>
                c.removeTemplate({
                    organizationId: T.org,
                    bundleId: T.bundle,
                    templateId: T.helmet,
                }),
            updateBundle: (c: ReturnType<typeof makeCaller>) =>
                c.updateBundle({
                    organizationId: T.org,
                    bundleId: T.bundle,
                    update: { name: "Nope", description: "" },
                }),
        };

        it.each(Object.keys(calls) as (keyof typeof calls)[])(
            "an i3-editor can't call %s",
            async (name) => {
                await expect(calls[name](makeCaller(Roles.editor))).rejects.toMatchObject({
                    code: "FORBIDDEN",
                });
            },
        );

        it("createBundle needs i3Bundle:create, not update", async () => {
            await expect(
                calls.createBundle(makeCaller({ ...Roles.editor, i3Bundle: ["view", "update"] })),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });

        it("deleteBundle and recoverBundle need i3Bundle:delete, not update", async () => {
            const caller = makeCaller({ ...Roles.editor, i3Bundle: ["view", "update"] });
            await expect(calls.deleteBundle(caller)).rejects.toMatchObject({ code: "FORBIDDEN" });
            await expect(calls.recoverBundle(caller)).rejects.toMatchObject({ code: "FORBIDDEN" });
        });

        it("an i3-editor can view", async () => {
            const caller = makeCaller(Roles.editor);
            await expect(caller.listBundles({ organizationId: T.org })).resolves.toBeDefined();
            await expect(
                caller.getBundle({ organizationId: T.org, bundleId: T.bundle }),
            ).resolves.toBeDefined();
        });

        it("a plain member can't view", async () => {
            const caller = makeCaller(Roles.member);
            await expect(caller.listBundles({ organizationId: T.org })).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
            await expect(
                caller.getBundle({ organizationId: T.org, bundleId: T.bundle }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });
    });

    it("getBundle returns the bundle with its lines", async () => {
        const result = await makeCaller(Roles.editor).getBundle({
            organizationId: T.org,
            bundleId: T.bundle,
        });

        expect(result.bundle).toMatchObject({ id: T.bundle, name: "Recruit" });
        expect(result.lines.map((line) => line.template.id)).toEqual([T.helmet]);
    });

    it("getBundle throws NOT_FOUND for an unknown bundle", async () => {
        await expect(
            makeCaller(Roles.editor).getBundle({
                organizationId: T.org,
                bundleId: I3BundleId.create(),
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("listBundles returns the bundles with their template counts", async () => {
        const bundles = await makeCaller(Roles.editor).listBundles({ organizationId: T.org });

        expect(bundles.find((b) => b.id === T.bundle)).toMatchObject({ templateCount: 1 });
    });

    it("creates, updates, edits lines of, deletes and recovers a bundle", async () => {
        const caller = makeCaller(Roles.admin);
        const bundleId = I3BundleId.create();

        const { created } = await caller.createBundle({
            organizationId: T.org,
            bundleId,
            create: { name: "Responder", description: "" },
        });
        expect(created).toMatchObject({ id: bundleId, name: "Responder", status: "Active" });

        const { updated: renamed } = await caller.updateBundle({
            organizationId: T.org,
            bundleId,
            update: { name: "Responder kit", description: "Standard issue" },
        });
        expect(renamed).toMatchObject({ name: "Responder kit", description: "Standard issue" });

        await caller.addTemplates({
            organizationId: T.org,
            bundleId,
            templateIds: [T.helmet, T.boots],
        });
        await caller.removeTemplate({ organizationId: T.org, bundleId, templateId: T.helmet });
        const { lines } = await caller.getBundle({ organizationId: T.org, bundleId });
        expect(lines.map((line) => line.template.id)).toEqual([T.boots]);

        const { deleted } = await caller.deleteBundle({ organizationId: T.org, bundleId });
        expect(deleted.status).toBe("Deleted");

        const { updated: recovered } = await caller.recoverBundle({
            organizationId: T.org,
            bundleId,
        });
        expect(recovered.status).toBe("Active");

        const entries = await db.logEntry.findMany({
            where: { objectType: "I3Bundle", objectId: bundleId },
        });
        expect(entries.map((entry) => entry.action).toSorted()).toEqual([
            "Create",
            "Delete",
            "Recover",
            "Update",
            "Update",
            "Update",
        ]);
    });
});
