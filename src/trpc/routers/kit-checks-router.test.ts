/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NotConfiguredError, NotFoundError } from "@/lib/errors";
import type { D4HEquipmentListItem } from "@/lib/schemas/d4h/equipment-item";
import { I3BundleId } from "@/lib/schemas/i3-bundle";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { I3TemplateVariantId } from "@/lib/schemas/i3-template-variant";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { fetchD4HTeamEquipmentItems } from "@/server/d4h-api/equipment";
import { listFitsForD4HTeam } from "@/server/services/i3-templates";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { kitChecksRouter } from "./kit-checks-router";

const TEAM_ID = 7;
const OTHER_TEAM_ID = 8;
const HELMET_KIND = 50;

const accessToken = { id: "d4h-token-fixture-id" };

vi.mock("@/server/d4h-access-token", () => ({
    getConfiguredD4HAccessToken: vi.fn(),
    toD4HCredentialRef: vi.fn((token: { id: string }) => ({
        credentialId: token.id,
        organizationId: null,
        userId: null,
    })),
}));

vi.mock("@/server/d4h-api/client", () => ({
    getD4HTokenMetadata: vi.fn(async () => ({
        d4HTeams: [
            { id: TEAM_ID, resourceType: "Team", title: "Rescue Team", permissions: {} },
            { id: OTHER_TEAM_ID, resourceType: "Team", title: "Alpine Team", permissions: {} },
        ],
        d4HOrganisations: [],
    })),
    getD4HTeamMembers: vi.fn(async () => [
        member(42, "John Smith", " john@example.com "),
        member(43, "Ana Lee", "  "),
    ]),
}));

vi.mock("@/server/d4h-api/equipment", async (importOriginal) => ({
    // Pure, so it runs for real.
    filterTeamIssuedItems: (await importOriginal<typeof import("@/server/d4h-api/equipment")>())
        .filterTeamIssuedItems,
    fetchD4HTeamEquipmentItems: vi.fn(),
}));

vi.mock("@/server/services/i3-templates", () => ({
    listFitsForD4HTeam: vi.fn(),
}));

function member(id: number, name: string, email: string) {
    return {
        id,
        resourceType: "Member",
        email: { value: email, verified: true },
        name,
        owner: { id: TEAM_ID, resourceType: "Team" },
        position: null,
        ref: null,
        role: { id: null, resourceType: "Role" },
        status: "OPERATIONAL",
    };
}

function issuedItem(id: number, holderId: number): D4HEquipmentListItem {
    return {
        id,
        ref: String(id),
        status: "OPERATIONAL",
        serial: null,
        owner: { resourceType: "Team", id: TEAM_ID },
        category: { resourceType: "EquipmentCategory", id: 1 },
        kind: { resourceType: "EquipmentKind", id: HELMET_KIND, title: "Helmet" },
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
        location: { resourceType: "Member", id: holderId },
    };
}

describe("kitChecksRouter", () => {
    const T = {
        org: OrganizationId.create(),
        admin: UserId.create(),
        owner: UserId.create(),
        bundle: I3BundleId.create(),
        deletedBundle: I3BundleId.create(),
        helmet: I3TemplateId.create(),
        radio: I3TemplateId.create(),
        helmetVariant: I3TemplateVariantId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.i3Template.create({
            data: {
                id: T.helmet,
                organizationId: T.org,
                name: "Helmet",
                description: "",
                d4h: {
                    create: {
                        categoryId: 1,
                        categoryTitle: "PPE",
                        kindId: HELMET_KIND,
                        kindTitle: "Helmet",
                        outputRefFormat: "",
                        requireSN: false,
                    },
                },
                variants: {
                    create: [
                        {
                            id: T.helmetVariant,
                            name: "Petzl Vertex",
                            d4h: {
                                create: {
                                    brandId: 1,
                                    brandTitle: "Petzl",
                                    modelId: 11,
                                    modelTitle: "Vertex",
                                },
                            },
                        },
                    ],
                },
            },
        });
        await db.i3Template.create({
            data: { id: T.radio, organizationId: T.org, name: "Radio", description: "" },
        });
        await db.i3Bundle.create({
            data: { id: T.bundle, organizationId: T.org, name: "Responder", description: "" },
        });
        await db.i3Bundle.create({
            data: {
                id: T.deletedBundle,
                organizationId: T.org,
                name: "Old",
                description: "",
                status: "Deleted",
            },
        });
        for (const templateId of [T.helmet, T.radio]) {
            await db.i3BundleItem.create({ data: { bundleId: T.bundle, templateId } });
        }
    });

    beforeEach(() => {
        vi.mocked(getConfiguredD4HAccessToken)
            .mockReset()
            .mockResolvedValue(accessToken as never);
        vi.mocked(fetchD4HTeamEquipmentItems)
            .mockReset()
            .mockResolvedValue([issuedItem(1, 42)]);
        vi.mocked(listFitsForD4HTeam)
            .mockReset()
            .mockResolvedValue({ templateIds: [T.helmet], variantIds: [T.helmetVariant] });
    });

    /** A system admin with no membership of the org. */
    const admin = () =>
        kitChecksRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.admin, role: "admin" },
                permissions: null,
                prisma: db,
            }),
        );

    /** An org owner, holding every org role, without the system admin role. */
    const owner = () =>
        kitChecksRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.owner },
                permissions: {
                    member: ["owner"],
                    i3Bundle: ["view"],
                    d4hEquipment: ["view"],
                },
                prisma: db,
            }),
        );

    const preview = { organizationId: T.org, bundleId: T.bundle, d4hTeamIds: [TEAM_ID] };

    describe("access", () => {
        it("refuses an org owner without the system admin role", async () => {
            await expect(owner().listBundles({ organizationId: T.org })).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
            await expect(owner().listD4HTeams({ organizationId: T.org })).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
            await expect(owner().previewRecipients(preview)).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
            expect(getConfiguredD4HAccessToken).not.toHaveBeenCalled();
        });

        it("is PRECONDITION_FAILED without a personal D4H token", async () => {
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No personal D4H access token."),
            );

            await expect(admin().listD4HTeams({ organizationId: T.org })).rejects.toMatchObject({
                code: "PRECONDITION_FAILED",
            });
            await expect(admin().previewRecipients(preview)).rejects.toMatchObject({
                code: "PRECONDITION_FAILED",
            });
        });
    });

    describe("listBundles", () => {
        it("lists the org's Active bundles", async () => {
            const bundles = await admin().listBundles({ organizationId: T.org });
            expect(bundles.map((bundle) => bundle.id)).toEqual([T.bundle]);
        });
    });

    describe("listD4HTeams", () => {
        it("lists the teams the caller's token reaches", async () => {
            const teams = await admin().listD4HTeams({ organizationId: T.org });
            expect(teams).toEqual([
                { id: TEAM_ID, resourceType: "Team", title: "Rescue Team" },
                { id: OTHER_TEAM_ID, resourceType: "Team", title: "Alpine Team" },
            ]);
        });
    });

    describe("previewRecipients", () => {
        it("lists each team's members with their email and held count, and the excluded lines", async () => {
            const result = await admin().previewRecipients(preview);

            expect(result).toEqual([
                {
                    team: { id: TEAM_ID, title: "Rescue Team" },
                    templateCount: 1,
                    members: [
                        { id: 43, name: "Ana Lee", email: null, heldCount: 0 },
                        { id: 42, name: "John Smith", email: "john@example.com", heldCount: 1 },
                    ],
                    excluded: [{ templateId: T.radio, name: "Radio", reason: "no-d4h-type" }],
                },
            ]);
            expect(fetchD4HTeamEquipmentItems).toHaveBeenCalledWith(accessToken, TEAM_ID);
        });

        it("is NOT_FOUND for a team the token can't reach, before reading D4H", async () => {
            await expect(
                admin().previewRecipients({ ...preview, d4hTeamIds: [TEAM_ID, 999] }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
            expect(fetchD4HTeamEquipmentItems).not.toHaveBeenCalled();
        });

        it("is NOT_FOUND when the fit check can't reach the team", async () => {
            vi.mocked(listFitsForD4HTeam).mockRejectedValue(
                new NotFoundError(`D4H team ${TEAM_ID} not found.`),
            );
            await expect(admin().previewRecipients(preview)).rejects.toMatchObject({
                code: "NOT_FOUND",
            });
        });

        it("is NOT_FOUND for a bundle outside the org, and BAD_REQUEST for a Deleted one", async () => {
            await expect(
                admin().previewRecipients({ ...preview, bundleId: I3BundleId.create() }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
            await expect(
                admin().previewRecipients({ ...preview, bundleId: T.deletedBundle }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        });
    });
});
