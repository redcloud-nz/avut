/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { format } from "date-fns";
import type { ReactElement } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TZDate } from "@date-fns/tz";
import { render } from "@react-email/components";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { compareBundle } from "@/lib/i3-bundle-compare";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import type { D4HEquipmentListItem } from "@/lib/schemas/d4h/equipment-item";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { I3BundleId, type I3BundleLine } from "@/lib/schemas/i3-bundle";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    SELF_AUDIT_TOKEN_DAYS,
    SelfAuditRequestId,
    SelfAuditResponseData,
    type SelfAuditCampaignId,
} from "@/lib/schemas/self-audit";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { EMPTY_ANSWER } from "@/lib/self-audit-validate";
import { getD4HTeamMembers } from "@/server/d4h-api/client";
import { fetchD4HTeamEquipmentItems } from "@/server/d4h-api/equipment";
import { createLinkToken } from "@/server/link-token";
import { listFitsForD4HTeam } from "@/server/services/i3-templates";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import {
    buildSelfAuditSnapshot,
    createCampaign,
    defaultCampaignName,
    listTeams,
    resendRequest,
    SEND_SPACING_MS,
    sendCampaign,
    statusOf,
    type SelfAuditIssuedItem,
    type SelfAuditSendDeps,
    type SelfAuditVariantSource,
} from "./self-audit-campaigns";
import { getSelfAuditByToken } from "./self-audit-public";

vi.mock("@/server/d4h-access-token", () => ({
    toD4HCredentialRef: vi.fn((token: { id: string }) => ({
        credentialId: token.id,
        organizationId: null,
        userId: null,
    })),
}));

vi.mock("@/server/d4h-api/client", () => ({
    getD4HTokenMetadata: vi.fn(async () => ({
        d4HTeams: [{ id: TEAM_ID, resourceType: "Team", title: "Rescue Team", permissions: {} }],
        d4HOrganisations: [],
    })),
    getD4HTeamMembers: vi.fn(async () => [
        d4hMember(42, "John Smith", " john@example.com "),
        d4hMember(43, "Ana Lee", "  "),
        d4hMember(44, "Kim Tan", "kim@example.com"),
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

function d4hMember(id: number, name: string, email: string) {
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

const TEAM_ID = 7;
const HARNESS_KIND = 100;
const GLOVES_KIND = 200;

const T = {
    harness: I3TemplateId.create(),
    gloves: I3TemplateId.create(),
};

/** A Rope/Harness line: serial required, brand and model required, two D4H variants. */
const harnessLine: I3BundleLine = {
    template: {
        id: T.harness,
        name: "Harness",
        status: "Active",
        d4h: {
            categoryId: 1,
            categoryTitle: "Rope",
            kindId: HARNESS_KIND,
            kindTitle: "Harness",
            requireSN: true,
            brandModelRule: "Required",
        },
        variants: [
            { brandId: 1, modelId: 11 },
            { brandId: 1, modelId: 12 },
        ],
    },
};

/** A PPE/Gloves line with no variants and no serial. */
const glovesLine: I3BundleLine = {
    template: {
        id: T.gloves,
        name: "Gloves",
        status: "Active",
        d4h: {
            categoryId: 2,
            categoryTitle: "PPE",
            kindId: GLOVES_KIND,
            kindTitle: "Gloves",
            requireSN: false,
            brandModelRule: "Optional",
        },
        variants: [],
    },
};

const variants: SelfAuditVariantSource[] = [
    { id: "avao", templateId: T.harness, name: "Petzl Avao", d4h: { brandId: 1, modelId: 11 } },
    { id: "falcon", templateId: T.harness, name: "Petzl Falcon", d4h: { brandId: 1, modelId: 12 } },
    // Fits no team: not offered.
    { id: "astro", templateId: T.harness, name: "Petzl Astro", d4h: { brandId: 1, modelId: 13 } },
    // No D4H record: not offered.
    { id: "other", templateId: T.harness, name: "Other harness", d4h: null },
];
const fittingVariantIds = ["avao", "falcon", "other"];

function item(
    id: number,
    holderId: number,
    kindId: number,
    overrides: Partial<D4HEquipmentListItem> = {},
): SelfAuditIssuedItem {
    return {
        id,
        ref: String(id).padStart(6, "0"),
        status: "OPERATIONAL",
        serial: null,
        owner: { resourceType: "Team", id: TEAM_ID },
        category: { resourceType: "EquipmentCategory", id: 1 },
        kind: { resourceType: "EquipmentKind", id: kindId, title: "Kind" },
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
        holder: { id: holderId },
        ...overrides,
    };
}

const members = [
    { id: 1, name: "Aroha", email: "aroha@example.com" },
    { id: 2, name: "Ben", email: null },
];

function snapshot(items: SelfAuditIssuedItem[]) {
    const comparison = compareBundle({
        lines: [harnessLine, glovesLine],
        members,
        items,
        fittingTemplateIds: [T.harness, T.gloves],
    });
    return buildSelfAuditSnapshot({
        columns: comparison.columns,
        rows: comparison.rows,
        variants,
        fittingVariantIds,
    });
}

describe("buildSelfAuditSnapshot", () => {
    it("offers a template's fitting variants with D4H records, and a free size without any", () => {
        const { templates } = snapshot([]);

        expect(templates).toEqual([
            {
                id: T.harness,
                category: "Rope",
                name: "Harness",
                variants: [
                    { id: "avao", label: "Petzl Avao" },
                    { id: "falcon", label: "Petzl Falcon" },
                ],
                requireSN: true,
                sized: false,
                sizeOptional: true,
                sizeOptions: [],
            },
            {
                id: T.gloves,
                category: "PPE",
                name: "Gloves",
                variants: [],
                requireSN: false,
                sized: true,
                sizeOptional: true,
                sizeOptions: [],
            },
        ]);
        expect(templates[0]).not.toHaveProperty("allowOwn");
        expect(templates[0]).not.toHaveProperty("optional");
    });

    it("lists each counted item, matching a variant on brand and model, with its serial", () => {
        const { members: result } = snapshot([
            item(10, 1, HARNESS_KIND, {
                serial: "H-1",
                brand: { resourceType: "EquipmentBrand", id: 1, title: "Petzl" },
                model: { resourceType: "EquipmentModel", id: 12, title: "Falcon" },
            }),
            item(11, 1, GLOVES_KIND),
            // LOST: doesn't count.
            item(12, 1, GLOVES_KIND, { status: "LOST" }),
        ]);

        const aroha = result.find((entry) => entry.member.id === 1)!;
        expect(aroha.heldCount).toBe(2);
        expect(aroha.heldItems).toEqual([
            {
                id: "10",
                templateId: T.harness,
                description: "Petzl Falcon",
                serial: "H-1",
                variantId: "falcon",
                problems: [],
            },
            {
                id: "11",
                templateId: T.gloves,
                description: "000011",
                serial: null,
                variantId: null,
                problems: [],
            },
        ]);

        const ben = result.find((entry) => entry.member.id === 2)!;
        expect(ben).toMatchObject({ member: members[1], heldCount: 0, heldItems: [] });
    });

    it("flags a missing serial, a missing model and a brand/model that's no variant", () => {
        const { members: result } = snapshot([
            // No serial, no model.
            item(20, 1, HARNESS_KIND, {
                brand: { resourceType: "EquipmentBrand", id: 1, title: "Petzl" },
            }),
            // Has a serial, but a model that's not one of the variants.
            item(21, 2, HARNESS_KIND, {
                serial: "H-2",
                brand: { resourceType: "EquipmentBrand", id: 1, title: "Petzl" },
                model: { resourceType: "EquipmentModel", id: 99, title: "Old" },
            }),
        ]);

        const byId = new Map(
            result.flatMap((entry) => entry.heldItems).map((held) => [held.id, held]),
        );
        expect(byId.get("20")).toMatchObject({
            description: "Petzl",
            variantId: null,
            problems: ["serial", "variant"],
        });
        expect(byId.get("21")).toMatchObject({ variantId: null, problems: ["variant"] });
    });

    it("lists an item once, under the first line, when two lines share its D4H kind", () => {
        const chestLine: I3BundleLine = {
            template: { ...harnessLine.template, id: I3TemplateId.create(), name: "Chest harness" },
        };
        const comparison = compareBundle({
            lines: [harnessLine, chestLine],
            members,
            items: [item(40, 1, HARNESS_KIND, { serial: "H-4" })],
            fittingTemplateIds: [harnessLine.template.id, chestLine.template.id],
        });
        const { members: result } = buildSelfAuditSnapshot({
            columns: comparison.columns,
            rows: comparison.rows,
            variants,
            fittingVariantIds,
        });

        const aroha = result.find((entry) => entry.member.id === 1)!;
        expect(aroha.heldItems.map((held) => [held.id, held.templateId])).toEqual([
            ["40", T.harness],
        ]);
        expect(Object.keys(aroha.response.held)).toEqual(["40"]);
    });

    it("asks about the variant of an item matching one that doesn't fit the team", () => {
        // Astro is one of the template's D4H variants, but doesn't fit the team.
        const withAstro: I3BundleLine = {
            template: {
                ...harnessLine.template,
                variants: [...harnessLine.template.variants, { brandId: 1, modelId: 13 }],
            },
        };
        const comparison = compareBundle({
            lines: [withAstro],
            members,
            items: [
                item(50, 1, HARNESS_KIND, {
                    serial: "H-5",
                    brand: { resourceType: "EquipmentBrand", id: 1, title: "Petzl" },
                    model: { resourceType: "EquipmentModel", id: 13, title: "Astro" },
                }),
            ],
            fittingTemplateIds: [T.harness],
        });
        const { members: result } = buildSelfAuditSnapshot({
            columns: comparison.columns,
            rows: comparison.rows,
            variants,
            fittingVariantIds,
        });

        expect(result.find((entry) => entry.member.id === 1)!.heldItems).toEqual([
            expect.objectContaining({ id: "50", variantId: null, problems: ["variant"] }),
        ]);
    });

    it("starts every held item unanswered, and nothing else", () => {
        const { members: result } = snapshot([item(30, 1, GLOVES_KIND), item(31, 1, GLOVES_KIND)]);

        const { response } = result.find((entry) => entry.member.id === 1)!;
        expect(response).toEqual({
            held: {
                "30": { ...EMPTY_ANSWER },
                "31": { ...EMPTY_ANSWER },
            },
            missing: {},
            extras: [],
            comments: "",
        });
        expect(SelfAuditResponseData.parse(response)).toEqual(response);
    });
});

describe("statusOf", () => {
    const base = {
        deliveryStatus: "Sent" as const,
        openedAt: null,
        submittedAt: null,
        formStatus: "Draft",
        withdrawnAt: null,
    };
    const at = new Date("2026-11-21T09:00:00Z");

    it.each([
        ["Withdrawn", { withdrawnAt: at, formStatus: "Submitted", submittedAt: at, openedAt: at }],
        ["Submitted", { formStatus: "Submitted", submittedAt: at, openedAt: at }],
        ["Editing", { submittedAt: at, openedAt: at }],
        ["Opened", { openedAt: at, deliveryStatus: "Failed" as const }],
        ["Failed", { deliveryStatus: "Failed" as const }],
        ["NoEmail", { deliveryStatus: "NoEmail" as const }],
        ["Sent", { deliveryStatus: "Sent" as const }],
        ["Sent", { deliveryStatus: "Pending" as const }],
        ["Unsent", { deliveryStatus: "Unsent" as const }],
    ] as const)("is %s by precedence", (expected, overrides) => {
        expect(statusOf({ ...base, ...overrides })).toBe(expected);
    });
});

describe("defaultCampaignName", () => {
    it("names the month in the given time zone", () => {
        // Still November in UTC, already December in New Zealand.
        const instant = new Date("2026-11-30T12:00:00Z");
        expect(defaultCampaignName("Responder", "Pacific/Auckland", instant)).toBe(
            "Responder Dec 2026",
        );
        expect(defaultCampaignName("Responder", "UTC", instant)).toBe("Responder Nov 2026");
    });
});

describe("campaigns", () => {
    const HELMET_KIND = 50;
    const UNREACHED_D4H_TEAM = 99;
    const S = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        admin: UserId.create(),
        bundle: I3BundleId.create(),
        helmet: I3TemplateId.create(),
        team: TeamId.create(),
        unlinkedTeam: TeamId.create(),
        archivedTeam: TeamId.create(),
        unreachedTeam: TeamId.create(),
        otherOrgTeam: TeamId.create(),
    };
    const db = createMockPrisma();
    const accessToken = { id: "d4h-token-fixture-id" } as unknown as D4HAccessToken_ServerOnly;

    const ctx = () =>
        createOrganizationMockContext({
            organizationId: S.org,
            user: { id: S.admin, name: "Ana Admin", role: "admin" },
            prisma: db,
        });

    /** Deps whose sends succeed, unless `failFor` names the recipient, with numbered tokens. */
    function makeDeps(failFor: string[] = []) {
        let tokens = 0;
        return {
            sendEmail: vi.fn<SelfAuditSendDeps["sendEmail"]>(async ({ to }) =>
                failFor.includes(String(to))
                    ? { ok: false as const, error: new Error("Resend said no") }
                    : { ok: true as const },
            ),
            sleep: vi.fn(async () => {}),
            createLinkToken: vi.fn(() => {
                tokens++;
                return { token: `token-${tokens}`, hash: `hash-${tokens}-${Math.random()}` };
            }),
        } satisfies SelfAuditSendDeps;
    }

    beforeAll(async () => {
        for (const [id, slug] of [
            [S.org, "acme"],
            [S.otherOrg, "other"],
        ] as const) {
            await db.organization.create({
                data: { id, name: slug === "acme" ? "Acme" : "Other", slug, createdAt: new Date() },
            });
        }
        await db.user.create({
            data: {
                id: S.admin,
                name: "Ana Admin",
                email: "ana.admin@example.com",
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        const teams = [
            { id: S.team, organizationId: S.org, name: "Rescue", d4hTeamId: TEAM_ID },
            { id: S.unlinkedTeam, organizationId: S.org, name: "Unlinked", d4hTeamId: null },
            {
                id: S.archivedTeam,
                organizationId: S.org,
                name: "Archived",
                d4hTeamId: TEAM_ID,
                status: "Archived" as const,
            },
            {
                id: S.unreachedTeam,
                organizationId: S.org,
                name: "Unreached",
                d4hTeamId: UNREACHED_D4H_TEAM,
            },
            { id: S.otherOrgTeam, organizationId: S.otherOrg, name: "Away", d4hTeamId: TEAM_ID },
        ];
        for (const { d4hTeamId, ...team } of teams) {
            await db.team.create({ data: team });
            if (d4hTeamId !== null) {
                await db.team_D4H.create({
                    data: {
                        teamId: team.id,
                        d4hTeamId,
                        d4hTeamName: d4hTeamId === TEAM_ID ? "Rescue Team" : "Far Away Team",
                        d4hServerCode: "ap",
                    },
                });
            }
        }
        await db.i3Template.create({
            data: {
                id: S.helmet,
                organizationId: S.org,
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
            },
        });
        await db.i3Bundle.create({
            data: { id: S.bundle, organizationId: S.org, name: "Responder", description: "" },
        });
        await db.i3BundleItem.create({ data: { bundleId: S.bundle, templateId: S.helmet } });
    });

    beforeEach(() => {
        vi.mocked(fetchD4HTeamEquipmentItems).mockResolvedValue([item(1, 42, HELMET_KIND)]);
        vi.mocked(listFitsForD4HTeam).mockResolvedValue({
            templateIds: [S.helmet],
            variantIds: [],
        });
    });

    const create = (overrides: { teamId?: TeamId; name?: string } = {}) =>
        createCampaign(ctx(), { accessToken, teamId: S.team, bundleId: S.bundle, ...overrides });

    /**
     * A Draft with three members as they were added, before D4H changed: John (42, an old
     * address; D4H now has another), Ana (43; D4H now has no email) and Kim (44), all `Unsent`,
     * and Lee (45), added with no email (`NoEmail`).
     */
    async function draftWithMembers() {
        const { campaignId } = await create();
        const members = [
            { d4hMemberId: 42, memberName: "Johnny Smith", email: "old-john@example.com" },
            { d4hMemberId: 43, memberName: "Ana Lee", email: "ana@example.com" },
            { d4hMemberId: 44, memberName: "Kim Tan", email: "kim@example.com" },
            { d4hMemberId: 45, memberName: "Lee Park", email: null },
        ];
        const ids: Record<number, SelfAuditRequestId> = {};
        for (const member of members) {
            const id = SelfAuditRequestId.create();
            const formInstanceId = FormInstanceId.create();
            ids[member.d4hMemberId] = id;
            await db.formInstance.create({
                data: {
                    id: formInstanceId,
                    formKey: "d4h-i3-self-audit",
                    organizationId: S.org,
                    userId: null,
                    formData: { held: {}, missing: {}, extras: [], comments: "" },
                    formStatus: "Draft",
                },
            });
            await db.selfAuditRequest.create({
                data: {
                    id,
                    organizationId: S.org,
                    campaignId,
                    ...member,
                    heldItems: [],
                    deliveryStatus: member.email === null ? "NoEmail" : "Unsent",
                    formInstanceId,
                },
            });
        }
        return { campaignId, ids };
    }

    const requestsOf = (campaignId: SelfAuditCampaignId) =>
        db.selfAuditRequest.findMany({ where: { campaignId }, orderBy: { d4hMemberId: "asc" } });

    describe("listTeams", () => {
        it("lists the org's Active teams linked to a D4H team the token reaches", async () => {
            expect(await listTeams(ctx(), accessToken)).toEqual([
                { id: S.team, name: "Rescue", d4hTeamId: TEAM_ID, d4hTeamName: "Rescue Team" },
            ]);
        });
    });

    describe("createCampaign", () => {
        it("creates a Draft pinned to the team, with its templates and no members", async () => {
            const { campaignId } = await create();

            const campaign = await db.selfAuditCampaign.findUniqueOrThrow({
                where: { id: campaignId },
                include: { requests: true },
            });
            expect(campaign).toMatchObject({
                organizationId: S.org,
                teamId: S.team,
                d4hTeamId: TEAM_ID,
                d4hTeamName: "Rescue Team",
                bundleId: S.bundle,
                bundleName: "Responder",
                sentAt: null,
                sentById: null,
                requests: [],
            });
            expect(campaign.templates).toEqual([
                expect.objectContaining({ id: S.helmet, name: "Helmet" }),
            ]);
        });

        it("names it after the bundle and the month in the org's time zone, unless named", async () => {
            const { campaignId } = await create();
            const month = format(new TZDate(new Date(), "Pacific/Auckland"), "MMM yyyy");
            expect(
                await db.selfAuditCampaign.findUniqueOrThrow({ where: { id: campaignId } }),
            ).toMatchObject({ name: `Responder ${month}` });

            const { campaignId: named } = await create({ name: "  Winter check  " });
            expect(
                await db.selfAuditCampaign.findUniqueOrThrow({ where: { id: named } }),
            ).toMatchObject({ name: "Winter check" });
        });

        it("logs one Create entry, in no batch", async () => {
            const { campaignId } = await create();
            const entries = await db.logEntry.findMany({ where: { objectId: campaignId } });
            expect(entries).toEqual([
                expect.objectContaining({
                    action: "Create",
                    objectType: "SelfAuditCampaign",
                    batchId: null,
                }),
            ]);
        });

        it("refuses a team with no D4H link, or one that isn't Active", async () => {
            for (const teamId of [S.unlinkedTeam, S.archivedTeam]) {
                await expect(create({ teamId })).rejects.toBeInstanceOf(ValidationError);
            }
        });

        it("refuses a team whose D4H team the token doesn't reach, or another org's team", async () => {
            const before = await db.selfAuditCampaign.count();
            for (const teamId of [S.unreachedTeam, S.otherOrgTeam]) {
                await expect(create({ teamId })).rejects.toBeInstanceOf(NotFoundError);
            }
            expect(await db.selfAuditCampaign.count()).toBe(before);
        });
    });

    describe("sendCampaign", () => {
        const send = (campaignId: SelfAuditCampaignId, deps: SelfAuditSendDeps) =>
            sendCampaign(ctx(), { accessToken, campaignId }, deps);

        it("emails only the Unsent members, at the addresses D4H has now", async () => {
            const { campaignId } = await draftWithMembers();
            const deps = makeDeps();
            const before = Date.now();

            const result = await send(campaignId, deps);

            expect(result).toEqual({ campaignId, sent: 2, failed: 0, noEmail: 1 });
            expect(deps.sendEmail).toHaveBeenCalledTimes(2);
            expect(deps.sendEmail.mock.calls.map(([args]) => args.to)).toEqual([
                "john@example.com",
                "kim@example.com",
            ]);
            const html = await render(deps.sendEmail.mock.calls[0][0].react as ReactElement);
            expect(html).toMatch(/href="[^"]*\/forms\/acme\/d4h-i3-self-audit\/token-1"/);
            expect(html).toContain("Rescue Team");
            expect(html).toContain("Ana Admin");

            const requests = await requestsOf(campaignId);
            expect(
                requests.map((request) => [
                    request.memberName,
                    request.email,
                    request.deliveryStatus,
                ]),
            ).toEqual([
                ["John Smith", "john@example.com", "Sent"],
                ["Ana Lee", null, "NoEmail"],
                ["Kim Tan", "kim@example.com", "Sent"],
                ["Lee Park", null, "NoEmail"],
            ]);
            const days = SELF_AUDIT_TOKEN_DAYS * 24 * 60 * 60 * 1000;
            expect(requests[0].expiresAt!.getTime()).toBeGreaterThanOrEqual(before + days);
            expect(requests[1]).toMatchObject({ tokenHash: null, sentAt: null });

            const campaign = await db.selfAuditCampaign.findUniqueOrThrow({
                where: { id: campaignId },
            });
            expect(campaign.sentById).toBe(S.admin);
            expect(campaign.sentAt!.getTime()).toBeGreaterThanOrEqual(before);
        });

        it("refuses a second send, emailing nobody", async () => {
            const { campaignId } = await draftWithMembers();
            await send(campaignId, makeDeps());

            const deps = makeDeps();
            await expect(send(campaignId, deps)).rejects.toBeInstanceOf(ConflictError);
            expect(deps.sendEmail).not.toHaveBeenCalled();
        });

        it("refuses a send another one claimed first, changing nothing", async () => {
            const { campaignId } = await draftWithMembers();
            // The other send claims it while this one reads D4H.
            vi.mocked(getD4HTeamMembers).mockImplementationOnce(async () => {
                await db.selfAuditCampaign.update({
                    where: { id: campaignId },
                    data: { sentAt: new Date() },
                });
                return [];
            });

            const deps = makeDeps();
            await expect(send(campaignId, deps)).rejects.toBeInstanceOf(ConflictError);
            expect(deps.sendEmail).not.toHaveBeenCalled();
            expect((await requestsOf(campaignId)).map((r) => r.deliveryStatus)).toEqual([
                "Unsent",
                "Unsent",
                "Unsent",
                "NoEmail",
            ]);
            expect(
                await db.logEntry.count({ where: { objectId: campaignId, action: "Update" } }),
            ).toBe(0);
        });

        it("refuses a Draft with nobody to send to, before reading D4H", async () => {
            const { campaignId } = await create();
            vi.mocked(getD4HTeamMembers).mockClear();

            await expect(send(campaignId, makeDeps())).rejects.toBeInstanceOf(ValidationError);
            expect(getD4HTeamMembers).not.toHaveBeenCalled();
            expect(
                await db.selfAuditCampaign.findUniqueOrThrow({ where: { id: campaignId } }),
            ).toMatchObject({ sentAt: null });
        });

        it("is NotFound for another org's campaign", async () => {
            const { campaignId } = await draftWithMembers();
            await expect(
                sendCampaign(
                    createOrganizationMockContext({
                        organizationId: S.otherOrg,
                        user: { id: S.admin, name: "Ana Admin", role: "admin" },
                        prisma: db,
                    }),
                    { accessToken, campaignId },
                    makeDeps(),
                ),
            ).rejects.toBeInstanceOf(NotFoundError);
        });

        it("marks a failed send Failed with no token, and sends the rest", async () => {
            const { campaignId } = await draftWithMembers();
            const result = await send(campaignId, makeDeps(["john@example.com"]));

            expect(result).toMatchObject({ sent: 1, failed: 1, noEmail: 1 });
            const [john, , kim] = await requestsOf(campaignId);
            expect(john).toMatchObject({
                deliveryStatus: "Failed",
                tokenHash: null,
                expiresAt: null,
                sentAt: null,
            });
            expect(kim).toMatchObject({ deliveryStatus: "Sent" });
        });

        it("counts a send whose Sent write keeps failing as sent, keeping its live link", async () => {
            const { campaignId } = await draftWithMembers();
            const deps = makeDeps();
            // John goes first: his Sent write and its one retry both fail.
            const update = db.selfAuditRequest.update.bind(db.selfAuditRequest);
            let sentWrites = 0;
            const spy = vi.spyOn(db.selfAuditRequest, "update").mockImplementation(((
                args: Parameters<typeof update>[0],
            ) => {
                if (args.data.deliveryStatus === "Sent" && ++sentWrites <= 2) {
                    return Promise.reject(new Error("Database unavailable"));
                }
                return update(args);
            }) as unknown as typeof update);
            let result;
            try {
                result = await send(campaignId, deps);
            } finally {
                spy.mockRestore();
            }

            // The email went out, so the link it carries must keep working.
            expect(result).toMatchObject({ sent: 2, failed: 0, noEmail: 1 });
            const [john, , kim] = await requestsOf(campaignId);
            expect(john).toMatchObject({ deliveryStatus: "Pending" });
            expect(john.tokenHash).not.toBeNull();
            expect(john.expiresAt).not.toBeNull();
            expect(kim).toMatchObject({ deliveryStatus: "Sent" });
        });

        it("retries a failed Sent write once", async () => {
            const { campaignId } = await draftWithMembers();
            const update = db.selfAuditRequest.update.bind(db.selfAuditRequest);
            let sentWrites = 0;
            const spy = vi.spyOn(db.selfAuditRequest, "update").mockImplementation(((
                args: Parameters<typeof update>[0],
            ) => {
                if (args.data.deliveryStatus === "Sent" && ++sentWrites === 1) {
                    return Promise.reject(new Error("Database blip"));
                }
                return update(args);
            }) as unknown as typeof update);
            let result;
            try {
                result = await send(campaignId, makeDeps());
            } finally {
                spy.mockRestore();
            }

            expect(result).toMatchObject({ sent: 2, failed: 0 });
        });

        it("spaces the sends, not before the first", async () => {
            const { campaignId } = await draftWithMembers();
            const deps = makeDeps();
            await send(campaignId, deps);

            expect(deps.sleep).toHaveBeenCalledTimes(1);
            expect(deps.sleep).toHaveBeenCalledWith(SEND_SPACING_MS);
            const [firstSend, secondSend] = deps.sendEmail.mock.invocationCallOrder;
            expect(deps.sleep.mock.invocationCallOrder[0]).toBeGreaterThan(firstSend);
            expect(deps.sleep.mock.invocationCallOrder[0]).toBeLessThan(secondSend);
        });

        it("leaves the rest Pending when the send is cut short, and they can be resent", async () => {
            const { campaignId, ids } = await draftWithMembers();
            const deps = makeDeps();
            deps.sleep.mockRejectedValueOnce(new Error("Function timed out"));

            await expect(send(campaignId, deps)).rejects.toThrow("Function timed out");
            const [john, , kim] = await requestsOf(campaignId);
            expect(john).toMatchObject({ deliveryStatus: "Sent" });
            expect(kim).toMatchObject({ deliveryStatus: "Pending", tokenHash: null });

            const result = await resendRequest(ctx(), ids[44], makeDeps());
            expect(result).toEqual({ campaignId, deliveryStatus: "Sent" });
            expect(
                await db.selfAuditRequest.findUniqueOrThrow({ where: { id: ids[44] } }),
            ).toMatchObject({ deliveryStatus: "Sent" });
        });

        it("logs the send, each refresh to no email and each outcome in one self-audit-campaign-send batch", async () => {
            const { campaignId, ids } = await draftWithMembers();
            await send(campaignId, makeDeps(["kim@example.com"]));

            const entries = await db.logEntry.findMany({
                where: { objectId: { in: [campaignId, ...Object.values(ids)] }, action: "Update" },
                orderBy: { sequence: "asc" },
            });
            const batchIds = [...new Set(entries.map((entry) => entry.batchId))];
            expect(batchIds).toHaveLength(1);
            const batch = await db.logBatch.findUniqueOrThrow({ where: { id: batchIds[0]! } });
            expect(batch).toMatchObject({
                operationKey: "self-audit-campaign-send",
                userId: S.admin,
            });

            expect(entries.map((entry) => [entry.objectType, entry.description])).toEqual([
                ["SelfAuditRequest", "Self-audit not sent to Ana Lee: no email in D4H"],
                ["SelfAuditCampaign", expect.stringContaining("sent to Rescue Team")],
                ["SelfAuditRequest", "Self-audit sent to John Smith (john@example.com)"],
                ["SelfAuditRequest", "Self-audit failed to send to Kim Tan (kim@example.com)"],
            ]);
        });
    });

    describe("resendRequest", () => {
        /** A sent campaign, and John's request (Sent) and Lee's (NoEmail). */
        async function sentCampaign() {
            const { campaignId, ids } = await draftWithMembers();
            await sendCampaign(ctx(), { accessToken, campaignId }, makeDeps());
            const john = await db.selfAuditRequest.findUniqueOrThrow({
                where: { id: ids[42] },
                include: { formInstance: true },
            });
            return { campaignId, john: { ...john, id: ids[42] }, lee: ids[45] };
        }

        /** Deps whose sends succeed (or all fail), issuing `resent-token`/`resent-hash`. */
        function resendDeps(fail = false) {
            const deps = makeDeps(fail ? ["john@example.com"] : []);
            deps.createLinkToken.mockReturnValue({ token: "resent-token", hash: "resent-hash" });
            return deps;
        }

        it("replaces the token, so the old one no longer resolves, and restarts expiry", async () => {
            const { campaignId, john } = await sentCampaign();
            const staleExpiry = new Date("2026-01-01T00:00:00Z");
            await db.selfAuditRequest.update({
                where: { id: john.id },
                data: { expiresAt: staleExpiry, sentAt: staleExpiry },
            });

            const deps = resendDeps();
            const before = Date.now();
            const result = await resendRequest(ctx(), john.id, deps);

            expect(result).toEqual({ campaignId, deliveryStatus: "Sent" });
            const after = await db.selfAuditRequest.findUniqueOrThrow({ where: { id: john.id } });
            expect(after).toMatchObject({ deliveryStatus: "Sent", tokenHash: "resent-hash" });
            expect(after.tokenHash).not.toBe(john.tokenHash);
            const days = SELF_AUDIT_TOKEN_DAYS * 24 * 60 * 60 * 1000;
            expect(after.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + days);
            expect(after.sentAt!.getTime()).toBeGreaterThanOrEqual(before);

            expect(deps.sendEmail).toHaveBeenCalledTimes(1);
            const html = await render(deps.sendEmail.mock.calls[0][0].react as ReactElement);
            expect(html).toMatch(/href="[^"]*\/forms\/acme\/d4h-i3-self-audit\/resent-token"/);
            expect(html).toContain("Rescue Team");

            const entries = await db.logEntry.findMany({
                where: { objectId: john.id, action: "Update" },
                orderBy: { sequence: "asc" },
            });
            const resent = entries.at(-1)!;
            expect(resent.description).toBe("Self-audit sent to John Smith (john@example.com)");
            const batch = await db.logBatch.findUniqueOrThrow({ where: { id: resent.batchId! } });
            expect(batch).toMatchObject({
                operationKey: "self-audit-campaign-send",
                userId: S.admin,
            });
            expect(resent.batchId).not.toBe(entries[0]!.batchId);
        });

        it("turns the old link not-found on the public form, and the new one opens it", async () => {
            const issued: string[] = [];
            /** Deps issuing real tokens, so the public lookup can hash them. */
            function realTokenDeps() {
                const deps = makeDeps();
                deps.createLinkToken.mockImplementation(() => {
                    const link = createLinkToken();
                    issued.push(link.token);
                    return link;
                });
                return deps;
            }
            const { campaignId, ids } = await draftWithMembers();
            await sendCampaign(ctx(), { accessToken, campaignId }, realTokenDeps());
            // John is sent first.
            const oldToken = issued[0]!;
            const link = (token: string) => ({ slug: "acme", token });
            expect(await getSelfAuditByToken({ prisma: db }, link(oldToken))).toMatchObject({
                state: "ok",
                subject: { teamName: "Rescue Team" },
            });

            await resendRequest(ctx(), ids[42], realTokenDeps());

            expect(await getSelfAuditByToken({ prisma: db }, link(oldToken))).toEqual({
                state: "not-found",
            });
            expect(await getSelfAuditByToken({ prisma: db }, link(issued.at(-1)!))).toMatchObject({
                state: "ok",
                subject: { memberName: "John Smith" },
            });
        });

        it("leaves a submitted request's answers and progress alone when the resend fails", async () => {
            const { john } = await sentCampaign();
            const openedAt = new Date("2026-11-21T09:00:00Z");
            const submittedAt = new Date("2026-11-22T09:00:00Z");
            const answer = john.formInstance.formData as SelfAuditResponseData;
            await db.selfAuditRequest.update({
                where: { id: john.id },
                data: { openedAt, submittedAt, submittedData: answer },
            });
            await db.formInstance.update({
                where: { id: john.formInstanceId },
                data: { formStatus: "Submitted" },
            });

            const result = await resendRequest(ctx(), john.id, resendDeps(true));

            expect(result.deliveryStatus).toBe("Failed");
            const after = await db.selfAuditRequest.findUniqueOrThrow({
                where: { id: john.id },
                include: { formInstance: true },
            });
            expect(after).toMatchObject({
                deliveryStatus: "Failed",
                tokenHash: null,
                expiresAt: null,
                sentAt: john.sentAt,
                openedAt,
                submittedAt,
                submittedData: answer,
                formInstanceId: john.formInstanceId,
            });
            expect(after.formInstance).toMatchObject({ formStatus: "Submitted", formData: answer });
        });

        it("refuses a NoEmail request, sending nothing", async () => {
            const { lee } = await sentCampaign();
            const deps = resendDeps();

            await expect(resendRequest(ctx(), lee, deps)).rejects.toBeInstanceOf(ValidationError);
            expect(deps.sendEmail).not.toHaveBeenCalled();
            expect(
                await db.selfAuditRequest.findUniqueOrThrow({ where: { id: lee } }),
            ).toMatchObject({ deliveryStatus: "NoEmail", tokenHash: null });
        });
    });
});
