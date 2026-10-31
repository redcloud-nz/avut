/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "@/lib/errors";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { I3TemplateVariantId } from "@/lib/schemas/i3-template-variant";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { getD4HTokenMetadata } from "@/server/d4h-api/client";
import { fetchD4HTeamEquipmentCatalogue } from "@/server/d4h-api/equipment";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import { deleteRecord, getById, listFitsForD4HTeam, recover, requireById } from "./i3-templates";

// The service reaches server-only modules at import time. The functions exercised here use an
// injected prisma client, so an empty stub is enough to let it import in jsdom.
vi.mock("server-only", () => ({}));

// The fit functions read the token's metadata and one team's catalogue from D4H: both canned.
vi.mock("@/server/d4h-access-token", () => ({
    toD4HCredentialRef: vi.fn(() => ({ credentialId: "token-1" })),
}));

vi.mock("@/server/d4h-api/client", () => ({
    getD4HTokenMetadata: vi.fn(),
}));

vi.mock("@/server/d4h-api/equipment", () => ({
    fetchD4HTeamEquipmentCatalogue: vi.fn(),
}));

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

describe("i3-templates listFitsForD4HTeam", () => {
    // D4H team 1 belongs to D4H organisation 100; team 2 is another team the token reaches.
    const D4H = { team: 1, otherTeam: 2, organisation: 100 };

    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        fitting: I3TemplateId.create(),
        fittingVariant: I3TemplateVariantId.create(),
        misfitVariant: I3TemplateVariantId.create(),
        misfit: I3TemplateId.create(),
        variantOfMisfit: I3TemplateVariantId.create(),
        deleted: I3TemplateId.create(),
        otherOrgTemplate: I3TemplateId.create(),
    };

    const accessToken = { id: "token-1" } as unknown as D4HAccessToken_ServerOnly;

    const team = (id: number) => ({ resourceType: "Team" as const, id, title: `Team ${id}` });
    const organisation = {
        resourceType: "Organisation" as const,
        id: D4H.organisation,
        title: "Org",
    };

    const db = createMockPrisma();

    function templateData(
        id: I3TemplateId,
        organizationId: OrganizationId,
        kindId: number,
        status: "Active" | "Deleted" = "Active",
    ) {
        return {
            id,
            organizationId,
            name: id,
            description: "",
            status,
            d4h: {
                create: {
                    categoryId: 10,
                    categoryTitle: "Clothing",
                    kindId,
                    kindTitle: `Kind ${kindId}`,
                    outputRefFormat: "",
                    requireSN: false,
                },
            },
        };
    }

    async function createVariant(
        id: I3TemplateVariantId,
        templateId: I3TemplateId,
        brandId: number,
    ) {
        await db.i3TemplateVariant.create({
            data: {
                id,
                templateId,
                name: id,
                d4h: {
                    create: {
                        brandId,
                        brandTitle: `Brand ${brandId}`,
                        modelId: 40,
                        modelTitle: "Model 40",
                    },
                },
            },
        });
    }

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        // Kind 20 is team 1's own; kind 21 is team 2's (listed by team 1, so it doesn't fit).
        await db.i3Template.create({ data: templateData(T.fitting, T.org, 20) });
        await db.i3Template.create({ data: templateData(T.misfit, T.org, 21) });
        await db.i3Template.create({ data: templateData(T.deleted, T.org, 20, "Deleted") });
        await db.i3Template.create({ data: templateData(T.otherOrgTemplate, T.otherOrg, 20) });

        // Brand 30 is team 1's own; brand 31 is team 2's.
        await createVariant(T.fittingVariant, T.fitting, 30);
        await createVariant(T.misfitVariant, T.fitting, 31);
        await createVariant(T.variantOfMisfit, T.misfit, 30);
    });

    beforeEach(() => {
        vi.mocked(getD4HTokenMetadata).mockResolvedValue({
            d4HTeams: [
                { ...team(D4H.team), owner: organisation, permissions: {} },
                { ...team(D4H.otherTeam), owner: organisation, permissions: {} },
            ],
            d4HOrganisations: [organisation],
        } as unknown as Awaited<ReturnType<typeof getD4HTokenMetadata>>);

        vi.mocked(fetchD4HTeamEquipmentCatalogue).mockResolvedValue({
            categories: [{ id: 10, title: "Clothing", owner: organisation }],
            kinds: [
                { id: 20, title: "Kind 20", owner: team(D4H.team) },
                { id: 21, title: "Kind 21", owner: team(D4H.otherTeam) },
            ],
            brands: [
                { id: 30, title: "Brand 30", owner: team(D4H.team) },
                { id: 31, title: "Brand 31", owner: team(D4H.otherTeam) },
            ],
            models: [{ id: 40, title: "Model 40", owner: organisation }],
        } as unknown as Awaited<ReturnType<typeof fetchD4HTeamEquipmentCatalogue>>);
    });

    function ctx() {
        return createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.user },
            permissions: {},
            prisma: db,
        });
    }

    it("returns a fitting template and its fitting variant", async () => {
        const fits = await listFitsForD4HTeam(ctx(), { accessToken, teamId: D4H.team });

        expect(fits.templateIds).toContain(T.fitting);
        expect(fits.variantIds).toContain(T.fittingVariant);
        expect(fetchD4HTeamEquipmentCatalogue).toHaveBeenCalledWith(
            accessToken,
            D4H.team,
            expect.objectContaining({ d4HOrganisations: [organisation] }),
        );
    });

    it("leaves out a template whose kind is owned by another team, and its variants", async () => {
        const fits = await listFitsForD4HTeam(ctx(), { accessToken, teamId: D4H.team });

        expect(fits.templateIds).not.toContain(T.misfit);
        expect(fits.variantIds).not.toContain(T.variantOfMisfit);
    });

    it("leaves out a misfit variant under a fitting template", async () => {
        const fits = await listFitsForD4HTeam(ctx(), { accessToken, teamId: D4H.team });

        expect(fits.templateIds).toContain(T.fitting);
        expect(fits.variantIds).not.toContain(T.misfitVariant);
    });

    it("excludes Deleted templates and other organizations' templates", async () => {
        const fits = await listFitsForD4HTeam(ctx(), { accessToken, teamId: D4H.team });

        expect(fits.templateIds).toEqual([T.fitting]);
    });

    it("throws NotFoundError for a team the token doesn't reach", async () => {
        await expect(listFitsForD4HTeam(ctx(), { accessToken, teamId: 999 })).rejects.toThrow(
            NotFoundError,
        );
        expect(fetchD4HTeamEquipmentCatalogue).not.toHaveBeenCalledWith(
            accessToken,
            999,
            expect.anything(),
        );
    });
});
