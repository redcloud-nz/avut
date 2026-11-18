/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { I3BundleId } from "@/lib/schemas/i3-bundle";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import {
    addTemplates,
    create,
    deleteRecord,
    getById,
    getWithLines,
    list,
    recover,
    removeTemplate,
    requireById,
    update,
} from "./i3-bundles";

describe("i3-bundles", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        bundle: I3BundleId.create(),
        deletedBundle: I3BundleId.create(),
        outsiderBundle: I3BundleId.create(),
        // Templates in T.org.
        helmet: I3TemplateId.create(), // PPE / Helmet
        boots: I3TemplateId.create(), // Clothing / Boots
        jacket: I3TemplateId.create(), // Clothing / Jacket
        radio: I3TemplateId.create(), // no D4H type
        oldRope: I3TemplateId.create(), // Deleted, Rope / Old Rope
        torch: I3TemplateId.create(), // PPE / Torch, not in any bundle
        // Template in T.otherOrg.
        outsider: I3TemplateId.create(),
    };

    const db = createMockPrisma();

    async function createTemplate(
        id: I3TemplateId,
        organizationId: OrganizationId,
        name: string,
        category: string | null,
        status: "Active" | "Deleted" = "Active",
    ) {
        await db.i3Template.create({
            data: {
                id,
                organizationId,
                name,
                description: "",
                status,
                d4h: category
                    ? {
                          create: {
                              categoryId: 1,
                              categoryTitle: category,
                              kindId: 10,
                              kindTitle: name,
                              outputRefFormat: "",
                              requireSN: false,
                          },
                      }
                    : undefined,
            },
        });
    }

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        await createTemplate(T.helmet, T.org, "Helmet", "PPE");
        await createTemplate(T.boots, T.org, "Boots", "Clothing");
        await createTemplate(T.jacket, T.org, "Jacket", "Clothing");
        await createTemplate(T.radio, T.org, "Radio", null);
        await createTemplate(T.oldRope, T.org, "Old Rope", "Rope", "Deleted");
        await createTemplate(T.torch, T.org, "Torch", "PPE");
        await createTemplate(T.outsider, T.otherOrg, "Outsider", "PPE");

        await db.i3Bundle.create({
            data: { id: T.bundle, organizationId: T.org, name: "Responder", description: "" },
        });
        await db.i3Bundle.create({
            data: {
                id: T.deletedBundle,
                organizationId: T.org,
                name: "Retired kit",
                description: "",
                status: "Deleted",
            },
        });
        await db.i3Bundle.create({
            data: {
                id: T.outsiderBundle,
                organizationId: T.otherOrg,
                name: "Other",
                description: "",
            },
        });

        // T.bundle: four lines, of which Helmet, Boots and Jacket can be compared.
        for (const templateId of [T.helmet, T.boots, T.jacket, T.radio, T.oldRope]) {
            await db.i3BundleItem.create({ data: { bundleId: T.bundle, templateId } });
        }
    });

    function ctx() {
        return createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.user },
            permissions: {},
            prisma: db,
        });
    }

    async function entriesFor(objectId: string) {
        return db.logEntry.findMany({
            where: { objectType: "I3Bundle", objectId },
            orderBy: { sequence: "asc" },
        });
    }

    async function refsOf(logEntryId: string) {
        const rows = await db.logEntryObject.findMany({
            where: { logEntryId, objectType: "I3Template" },
        });
        return rows.map((row) => ({ objectId: row.objectId, role: row.role }));
    }

    describe("getById / requireById", () => {
        it("returns a bundle in the organization", async () => {
            expect((await getById(ctx(), T.bundle))?.name).toBe("Responder");
            expect((await requireById(ctx(), T.bundle)).id).toBe(T.bundle);
        });

        it("does not reach across organizations", async () => {
            expect(await getById(ctx(), T.outsiderBundle)).toBeNull();
            await expect(requireById(ctx(), T.outsiderBundle)).rejects.toThrow(NotFoundError);
        });
    });

    describe("list", () => {
        it("lists the organization's non-Deleted bundles with their comparable line count", async () => {
            const bundles = await list(ctx());

            expect(bundles.map((bundle) => bundle.id)).toEqual([T.bundle]);
            // Radio has no D4H type and Old Rope is Deleted.
            expect(bundles[0].templateCount).toBe(3);
        });
    });

    describe("getWithLines", () => {
        it("returns every line, sorted by category then name, with untyped lines last", async () => {
            const result = await getWithLines(ctx(), T.bundle);

            expect(result?.bundle.id).toBe(T.bundle);
            expect(result?.lines.map((line) => line.template.name)).toEqual([
                "Boots",
                "Jacket",
                "Helmet",
                "Old Rope",
                "Radio",
            ]);
            expect(result?.lines[3].template.status).toBe("Deleted");
            expect(result?.lines[4].template.d4h).toBeNull();
            expect(result?.lines[0].template.d4h).toMatchObject({
                categoryTitle: "Clothing",
                kindTitle: "Boots",
            });
        });

        it("returns null for a bundle in another organization", async () => {
            expect(await getWithLines(ctx(), T.outsiderBundle)).toBeNull();
        });
    });

    describe("create / update", () => {
        const C = { bundle: I3BundleId.create() };

        it("creates a bundle with a Create entry", async () => {
            const created = await create(ctx(), C.bundle, {
                name: "Recruit",
                description: "First issue",
            });

            expect(created).toMatchObject({
                id: C.bundle,
                organizationId: T.org,
                name: "Recruit",
                status: "Active",
            });

            const [entry] = await entriesFor(C.bundle);
            expect(entry.action).toBe("Create");
            expect(JSON.stringify(entry.changes)).toContain("First issue");
        });

        it("updates name and description with an Update entry", async () => {
            const updated = await update(ctx(), C.bundle, {
                name: "Recruit kit",
                description: "First issue",
            });

            expect(updated.name).toBe("Recruit kit");

            const entries = await entriesFor(C.bundle);
            expect(entries).toHaveLength(2);
            expect(entries[1].action).toBe("Update");
            expect(JSON.stringify(entries[1].changes)).toContain("Recruit kit");
        });

        it("writes nothing for a no-op update", async () => {
            await update(ctx(), C.bundle, { name: "Recruit kit", description: "First issue" });

            expect(await entriesFor(C.bundle)).toHaveLength(2);
        });

        it("rejects updating a bundle in another organization", async () => {
            await expect(
                update(ctx(), T.outsiderBundle, { name: "x", description: "" }),
            ).rejects.toThrow(NotFoundError);
        });
    });

    describe("addTemplates", () => {
        const A = { bundle: I3BundleId.create() };

        beforeAll(async () => {
            await db.i3Bundle.create({
                data: { id: A.bundle, organizationId: T.org, name: "Add", description: "" },
            });
            await db.i3BundleItem.create({ data: { bundleId: A.bundle, templateId: T.helmet } });
        });

        it("adds new templates, skips ones already in, and logs one entry with refs", async () => {
            const before = await requireById(ctx(), A.bundle);

            await addTemplates(ctx(), A.bundle, [T.helmet, T.boots, T.torch, T.boots]);

            const lines = await db.i3BundleItem.findMany({ where: { bundleId: A.bundle } });
            expect(lines.map((line) => line.templateId).sort()).toEqual(
                [T.helmet, T.boots, T.torch].sort(),
            );

            const entries = await entriesFor(A.bundle);
            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({
                action: "Update",
                description: "Added templates: Boots, Torch",
            });
            expect(await refsOf(entries[0].id)).toEqual(
                expect.arrayContaining([
                    { objectId: T.boots, role: "context" },
                    { objectId: T.torch, role: "context" },
                ]),
            );
            expect(await refsOf(entries[0].id)).toHaveLength(2);

            const after = await requireById(ctx(), A.bundle);
            expect(after.updatedAt >= before.updatedAt).toBe(true);
        });

        it("writes nothing when every template is already in the bundle", async () => {
            await addTemplates(ctx(), A.bundle, [T.helmet, T.boots]);

            expect(await entriesFor(A.bundle)).toHaveLength(1);
        });

        it.each([
            ["in another organization", () => T.outsider],
            ["Deleted", () => T.oldRope],
            ["without a D4H type", () => T.radio],
            ["that does not exist", () => I3TemplateId.create()],
        ])("rejects a template %s and adds nothing", async (_label, templateId) => {
            await expect(addTemplates(ctx(), A.bundle, [T.jacket, templateId()])).rejects.toThrow(
                ValidationError,
            );

            expect(
                await db.i3BundleItem.findFirst({
                    where: { bundleId: A.bundle, templateId: T.jacket },
                }),
            ).toBeNull();
            expect(await entriesFor(A.bundle)).toHaveLength(1);
        });

        it("rejects a bundle in another organization", async () => {
            await expect(addTemplates(ctx(), T.outsiderBundle, [T.helmet])).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe("removeTemplate", () => {
        const R = { bundle: I3BundleId.create() };

        beforeAll(async () => {
            await db.i3Bundle.create({
                data: { id: R.bundle, organizationId: T.org, name: "Remove", description: "" },
            });
            for (const templateId of [T.helmet, T.oldRope]) {
                await db.i3BundleItem.create({ data: { bundleId: R.bundle, templateId } });
            }
        });

        it("removes the line and logs an Update naming the template, with a ref", async () => {
            await removeTemplate(ctx(), R.bundle, T.helmet);

            expect(await db.i3BundleItem.findMany({ where: { bundleId: R.bundle } })).toHaveLength(
                1,
            );

            const [entry] = await entriesFor(R.bundle);
            expect(entry).toMatchObject({
                action: "Update",
                description: "Removed template: Helmet",
            });
            expect(await refsOf(entry.id)).toEqual([{ objectId: T.helmet, role: "context" }]);
        });

        it("removes a line whose template is Deleted", async () => {
            await removeTemplate(ctx(), R.bundle, T.oldRope);

            expect(await db.i3BundleItem.findMany({ where: { bundleId: R.bundle } })).toHaveLength(
                0,
            );
        });

        it("throws NotFoundError for a template not in the bundle", async () => {
            await expect(removeTemplate(ctx(), R.bundle, T.helmet)).rejects.toThrow(NotFoundError);
            expect(await entriesFor(R.bundle)).toHaveLength(2);
        });

        it("throws NotFoundError for a bundle in another organization", async () => {
            await expect(removeTemplate(ctx(), T.outsiderBundle, T.helmet)).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe("deleted-bundle guard", () => {
        it("rejects update, addTemplates and removeTemplate on a Deleted bundle", async () => {
            await expect(
                update(ctx(), T.deletedBundle, { name: "x", description: "" }),
            ).rejects.toThrow(ValidationError);
            await expect(addTemplates(ctx(), T.deletedBundle, [T.helmet])).rejects.toThrow(
                ValidationError,
            );
            await expect(removeTemplate(ctx(), T.deletedBundle, T.helmet)).rejects.toThrow(
                ValidationError,
            );

            expect(await entriesFor(T.deletedBundle)).toHaveLength(0);
        });
    });

    describe("deleteRecord / recover", () => {
        const L = { bundle: I3BundleId.create() };

        beforeAll(async () => {
            await db.i3Bundle.create({
                data: { id: L.bundle, organizationId: T.org, name: "Lifecycle", description: "" },
            });
            await db.i3BundleItem.create({ data: { bundleId: L.bundle, templateId: T.helmet } });
        });

        it("recover no-ops on an Active bundle", async () => {
            await expect(recover(ctx(), L.bundle)).resolves.toMatchObject({ status: "Active" });
            expect(await entriesFor(L.bundle)).toHaveLength(0);
        });

        it("deleteRecord moves an Active bundle to Deleted, keeps its lines, and is idempotent", async () => {
            expect((await deleteRecord(ctx(), L.bundle)).status).toBe("Deleted");
            await deleteRecord(ctx(), L.bundle);

            const entries = await entriesFor(L.bundle);
            expect(entries.map((entry) => entry.action)).toEqual(["Delete"]);
            expect(await db.i3BundleItem.findMany({ where: { bundleId: L.bundle } })).toHaveLength(
                1,
            );
            expect((await list(ctx())).map((bundle) => bundle.id)).not.toContain(L.bundle);
        });

        it("recover moves a Deleted bundle back to Active and is idempotent", async () => {
            expect((await recover(ctx(), L.bundle)).status).toBe("Active");
            await recover(ctx(), L.bundle);

            const entries = await entriesFor(L.bundle);
            expect(entries.map((entry) => entry.action)).toEqual(["Delete", "Recover"]);
        });

        it("throws NotFoundError for a bundle in another organization", async () => {
            await expect(deleteRecord(ctx(), T.outsiderBundle)).rejects.toThrow(NotFoundError);
            await expect(recover(ctx(), T.outsiderBundle)).rejects.toThrow(NotFoundError);
        });
    });
});
