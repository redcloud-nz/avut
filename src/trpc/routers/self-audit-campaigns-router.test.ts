/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NotConfiguredError } from "@/lib/errors";
import type { D4HEquipmentListItem } from "@/lib/schemas/d4h/equipment-item";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { I3BundleId } from "@/lib/schemas/i3-bundle";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { I3TemplateVariantId } from "@/lib/schemas/i3-template-variant";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    SelfAuditCampaignId,
    SelfAuditRequestId,
    type SelfAuditHeldItem,
    type SelfAuditResponseData,
    type SelfAuditStatus,
    type SelfAuditTemplate,
} from "@/lib/schemas/self-audit";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { EMPTY_ANSWER } from "@/lib/self-audit-validate";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { fetchD4HTeamEquipmentItems } from "@/server/d4h-api/equipment";
import { sendEmail } from "@/server/email";
import { listFitsForD4HTeam } from "@/server/services/i3-templates";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { selfAuditCampaignsRouter } from "./self-audit-campaigns-router";

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

vi.mock("@/server/email", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/server/email")>()),
    sendEmail: vi.fn(async () => ({ ok: true as const })),
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

describe("selfAuditCampaignsRouter", () => {
    const T = {
        org: OrganizationId.create(),
        admin: UserId.create(),
        owner: UserId.create(),
        bundle: I3BundleId.create(),
        deletedBundle: I3BundleId.create(),
        helmet: I3TemplateId.create(),
        radio: I3TemplateId.create(),
        helmetVariant: I3TemplateVariantId.create(),
        team: TeamId.create(),
        alpineTeam: TeamId.create(),
        unlinkedTeam: TeamId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        for (const [id, name, d4hTeamId, d4hTeamName] of [
            [T.team, "Rescue", TEAM_ID, "Rescue Team"],
            [T.alpineTeam, "Alpine", OTHER_TEAM_ID, "Alpine Team"],
            [T.unlinkedTeam, "Unlinked", null, null],
        ] as const) {
            await db.team.create({ data: { id, organizationId: T.org, name } });
            if (d4hTeamId !== null) {
                await db.team_D4H.create({
                    data: { teamId: id, d4hTeamId, d4hTeamName, d4hServerCode: "ap" },
                });
            }
        }
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
        selfAuditCampaignsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.admin, role: "admin" },
                permissions: null,
                prisma: db,
            }),
        );

    /** An org owner, holding every org role, without the system admin role. */
    const owner = () =>
        selfAuditCampaignsRouter.createCaller(
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

    const create = { organizationId: T.org, teamId: T.team, bundleId: T.bundle };

    /** A Draft of the bundle for the Rescue team, with John (42) and Ana (43) added, `Unsent`. */
    async function draftWithMembers() {
        const { campaignId } = await admin().createCampaign(create);
        for (const [d4hMemberId, memberName] of [
            [42, "John Smith"],
            [43, "Ana Lee"],
        ] as const) {
            const formInstanceId = FormInstanceId.create();
            await db.formInstance.create({
                data: {
                    id: formInstanceId,
                    formKey: "d4h-i3-self-audit",
                    organizationId: T.org,
                    formData: { held: {}, missing: {}, extras: [], comments: "" },
                    formStatus: "Draft",
                },
            });
            await db.selfAuditRequest.create({
                data: {
                    id: SelfAuditRequestId.create(),
                    organizationId: T.org,
                    campaignId,
                    d4hMemberId,
                    memberName,
                    email: `${memberName.split(" ")[0].toLowerCase()}@example.com`,
                    heldItems: [],
                    deliveryStatus: "Unsent",
                    formInstanceId,
                },
            });
        }
        return campaignId;
    }

    describe("access", () => {
        it("refuses an org owner without the system admin role", async () => {
            await expect(owner().listBundles({ organizationId: T.org })).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
            await expect(owner().listTeams({ organizationId: T.org })).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
            expect(getConfiguredD4HAccessToken).not.toHaveBeenCalled();
        });

        it("is PRECONDITION_FAILED without a personal D4H token", async () => {
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No personal D4H access token."),
            );

            await expect(admin().listTeams({ organizationId: T.org })).rejects.toMatchObject({
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

    describe("listTeams", () => {
        it("lists the org's teams linked to a D4H team the caller's token reaches", async () => {
            const teams = await admin().listTeams({ organizationId: T.org });
            expect(teams).toEqual([
                {
                    id: T.alpineTeam,
                    name: "Alpine",
                    d4hTeamId: OTHER_TEAM_ID,
                    d4hTeamName: "Alpine Team",
                },
                { id: T.team, name: "Rescue", d4hTeamId: TEAM_ID, d4hTeamName: "Rescue Team" },
            ]);
        });
    });

    describe("admin reads", () => {
        const R = {
            check: SelfAuditCampaignId.create(),
            otherCheck: SelfAuditCampaignId.create(),
            notOpened: SelfAuditRequestId.create(),
            opened: SelfAuditRequestId.create(),
            submitted: SelfAuditRequestId.create(),
            editing: SelfAuditRequestId.create(),
            noEmail: SelfAuditRequestId.create(),
            otherRequest: SelfAuditRequestId.create(),
        };
        const otherOrg = OrganizationId.create();
        const sentAt = new Date("2026-11-20T09:00:00Z");
        const expiresAt = new Date("2026-12-04T09:00:00Z");
        const openedAt = new Date("2026-11-21T09:00:00Z");
        const submittedAt = new Date("2026-11-22T09:00:00Z");

        const template: SelfAuditTemplate = {
            id: T.helmet,
            category: "PPE",
            name: "Helmet",
            variants: [{ id: T.helmetVariant, label: "Petzl Vertex" }],
            requireSN: false,
            sized: false,
            sizeOptional: true,
            sizeOptions: [],
        };
        const heldItem: SelfAuditHeldItem = {
            id: "1",
            templateId: T.helmet,
            description: "Petzl Vertex",
            serial: null,
            variantId: T.helmetVariant,
            problems: [],
        };
        const draft: SelfAuditResponseData = {
            held: { "1": { ...EMPTY_ANSWER, has: "yes" } },
            missing: {},
            extras: [],
            comments: "",
        };
        const submitted: SelfAuditResponseData = { ...draft, comments: "All good" };

        beforeAll(async () => {
            await db.user.create({
                data: { id: T.admin, name: "Sam Admin", email: "sam@example.com" },
            });
            await db.organization.create({
                data: { id: otherOrg, name: "Other", slug: "other", createdAt: new Date() },
            });
            await db.selfAuditCampaign.create({
                data: {
                    id: R.check,
                    organizationId: T.org,
                    name: "Responder Nov 2026",
                    teamId: T.team,
                    d4hTeamId: TEAM_ID,
                    d4hTeamName: "Rescue Team",
                    bundleId: T.bundle,
                    bundleName: "Responder",
                    templates: [template],
                    sentAt,
                    sentById: T.admin,
                    createdAt: sentAt,
                },
            });
            await db.selfAuditCampaign.create({
                data: {
                    id: R.otherCheck,
                    organizationId: otherOrg,
                    name: "Elsewhere",
                    teamId: T.team,
                    d4hTeamId: TEAM_ID,
                    d4hTeamName: "Rescue Team",
                    bundleName: "Elsewhere",
                    templates: [],
                },
            });

            const requests: {
                id: SelfAuditRequestId;
                organizationId: OrganizationId;
                campaignId: SelfAuditCampaignId;
                memberId: number;
                memberName: string;
                email: string | null;
                deliveryStatus: "Sent" | "NoEmail" | "Failed";
                openedAt?: Date;
                submittedAt?: Date;
                submittedData?: SelfAuditResponseData;
                formStatus: "Draft" | "Submitted";
            }[] = [
                {
                    id: R.notOpened,
                    organizationId: T.org,
                    campaignId: R.check,
                    memberId: 1,
                    memberName: "Zoe North",
                    email: "zoe@example.com",
                    deliveryStatus: "Sent",
                    formStatus: "Draft",
                },
                {
                    id: R.opened,
                    organizationId: T.org,
                    campaignId: R.check,
                    memberId: 2,
                    memberName: "Ana Lee",
                    email: "ana@example.com",
                    deliveryStatus: "Failed",
                    openedAt,
                    formStatus: "Draft",
                },
                {
                    id: R.submitted,
                    organizationId: T.org,
                    campaignId: R.check,
                    memberId: 3,
                    memberName: "Bo Hill",
                    email: "bo@example.com",
                    deliveryStatus: "Sent",
                    openedAt,
                    submittedAt,
                    submittedData: submitted,
                    formStatus: "Submitted",
                },
                {
                    id: R.editing,
                    organizationId: T.org,
                    campaignId: R.check,
                    memberId: 4,
                    memberName: "John Smith",
                    email: "john@example.com",
                    deliveryStatus: "Sent",
                    openedAt,
                    submittedAt,
                    submittedData: submitted,
                    formStatus: "Draft",
                },
                {
                    id: R.noEmail,
                    organizationId: T.org,
                    campaignId: R.check,
                    memberId: 5,
                    memberName: "Kim Park",
                    email: null,
                    deliveryStatus: "NoEmail",
                    formStatus: "Draft",
                },
                {
                    id: R.otherRequest,
                    organizationId: otherOrg,
                    campaignId: R.otherCheck,
                    memberId: 1,
                    memberName: "Elsewhere Member",
                    email: "else@example.com",
                    deliveryStatus: "Sent",
                    formStatus: "Draft",
                },
            ];

            for (const request of requests) {
                const formInstanceId = FormInstanceId.create();
                await db.formInstance.create({
                    data: {
                        id: formInstanceId,
                        formKey: "d4h-i3-self-audit",
                        organizationId: request.organizationId,
                        formData: draft,
                        formStatus: request.formStatus,
                    },
                });
                const sent = request.deliveryStatus === "Sent";
                await db.selfAuditRequest.create({
                    data: {
                        id: request.id,
                        organizationId: request.organizationId,
                        campaignId: request.campaignId,
                        d4hMemberId: request.memberId,
                        memberName: request.memberName,
                        email: request.email,
                        heldItems: [heldItem],
                        tokenHash: sent ? `hash-${request.id}` : null,
                        expiresAt: sent ? expiresAt : null,
                        deliveryStatus: request.deliveryStatus,
                        sentAt: sent ? sentAt : null,
                        openedAt: request.openedAt ?? null,
                        submittedAt: request.submittedAt ?? null,
                        submittedData: request.submittedData,
                        formInstanceId,
                    },
                });
            }
        });

        it("refuses an org owner without the system admin role", async () => {
            await expect(owner().listCampaigns({ organizationId: T.org })).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
            await expect(
                owner().getCampaign({ organizationId: T.org, campaignId: R.check }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
            await expect(
                owner().getRequestAnswers({ organizationId: T.org, requestId: R.submitted }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });

        const counts: Record<SelfAuditStatus, number> = {
            Withdrawn: 0,
            Submitted: 1,
            Editing: 1,
            Opened: 1,
            Failed: 0,
            NoEmail: 1,
            Sent: 1,
            Unsent: 0,
        };

        it("lists the org's self audit campaigns with their counts", async () => {
            const checks = await admin().listCampaigns({ organizationId: T.org });

            expect(checks).toEqual([
                {
                    id: R.check,
                    name: "Responder Nov 2026",
                    team: { id: T.team, name: "Rescue" },
                    d4hTeamName: "Rescue Team",
                    bundleName: "Responder",
                    sentAt,
                    sentByName: "Sam Admin",
                    createdAt: sentAt,
                    updatedAt: expect.any(Date),
                    counts,
                },
            ]);
        });

        it("gets a self audit campaign with its requests by member, and their status", async () => {
            const check = await admin().getCampaign({ organizationId: T.org, campaignId: R.check });

            expect(check).toMatchObject({ id: R.check, sentByName: "Sam Admin", counts });
            expect(check.requests.map((request) => [request.memberName, request.status])).toEqual([
                ["Ana Lee", "Opened"],
                ["Bo Hill", "Submitted"],
                ["John Smith", "Editing"],
                ["Kim Park", "NoEmail"],
                ["Zoe North", "Sent"],
            ]);
            expect(check.requests.find((request) => request.id === R.editing)).toEqual({
                id: R.editing,
                d4hMemberId: 4,
                memberName: "John Smith",
                email: "john@example.com",
                deliveryStatus: "Sent",
                sentAt,
                openedAt,
                submittedAt,
                expiresAt,
                withdrawnAt: null,
                formStatus: "Draft",
                status: "Editing",
            });
        });

        it("gets a request's snapshot and its answers", async () => {
            const answers = await admin().getRequestAnswers({
                organizationId: T.org,
                requestId: R.submitted,
            });

            expect(answers).toEqual({
                templates: [template],
                heldItems: [heldItem],
                submittedData: submitted,
                formData: draft,
                formStatus: "Submitted",
            });

            const unsubmitted = await admin().getRequestAnswers({
                organizationId: T.org,
                requestId: R.opened,
            });
            expect(unsubmitted).toMatchObject({
                templates: [template],
                submittedData: null,
                formData: draft,
                formStatus: "Draft",
            });
        });

        it("is NOT_FOUND for another org's self audit campaign or request", async () => {
            await expect(
                admin().getCampaign({ organizationId: T.org, campaignId: R.otherCheck }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
            await expect(
                admin().getRequestAnswers({ organizationId: T.org, requestId: R.otherRequest }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        it("never returns a token hash", async () => {
            const outputs = [
                await admin().listCampaigns({ organizationId: T.org }),
                await admin().getCampaign({ organizationId: T.org, campaignId: R.check }),
                await admin().getRequestAnswers({ organizationId: T.org, requestId: R.editing }),
            ];
            for (const output of outputs) {
                const json = JSON.stringify(output);
                expect(json).not.toContain("tokenHash");
                expect(json).not.toContain("hash-");
            }
        });
    });

    describe("createCampaign", () => {
        it("creates a Draft with no members, and lists it", async () => {
            const { campaignId } = await admin().createCampaign({
                ...create,
                name: "Winter check",
            });

            const campaign = await admin().getCampaign({ organizationId: T.org, campaignId });
            expect(campaign).toMatchObject({
                id: campaignId,
                name: "Winter check",
                team: { id: T.team, name: "Rescue" },
                d4hTeamName: "Rescue Team",
                bundleName: "Responder",
                sentAt: null,
                sentByName: null,
                requests: [],
            });
            expect(sendEmail).not.toHaveBeenCalled();
        });

        it("is BAD_REQUEST for a team with no D4H link, or a Deleted bundle", async () => {
            await expect(
                admin().createCampaign({ ...create, teamId: T.unlinkedTeam }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
            await expect(
                admin().createCampaign({ ...create, bundleId: T.deletedBundle }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        });

        it("is NOT_FOUND for a team or bundle outside the org", async () => {
            await expect(
                admin().createCampaign({ ...create, teamId: TeamId.create() }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
            await expect(
                admin().createCampaign({ ...create, bundleId: I3BundleId.create() }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        it("refuses an org owner without the system admin role", async () => {
            await expect(owner().createCampaign(create)).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
        });

        it("is PRECONDITION_FAILED without a personal D4H token", async () => {
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No personal D4H access token."),
            );
            await expect(admin().createCampaign(create)).rejects.toMatchObject({
                code: "PRECONDITION_FAILED",
            });
        });
    });

    describe("sendCampaign", () => {
        it("sends to the members with an email in D4H, and returns the counts", async () => {
            const campaignId = await draftWithMembers();

            const result = await admin().sendCampaign({ organizationId: T.org, campaignId });

            expect(result).toEqual({ campaignId, sent: 1, failed: 0, noEmail: 1 });
            expect(sendEmail).toHaveBeenCalledTimes(1);
            expect(sendEmail).toHaveBeenCalledWith(
                expect.objectContaining({ to: "john@example.com" }),
            );

            const campaign = await admin().getCampaign({ organizationId: T.org, campaignId });
            expect(campaign).toMatchObject({ sentByName: "Sam Admin" });
            expect(campaign.sentAt).not.toBeNull();
            expect(
                campaign.requests.map((request) => [request.memberName, request.status]),
            ).toEqual([
                ["Ana Lee", "NoEmail"],
                ["John Smith", "Sent"],
            ]);
        });

        it("is CONFLICT for a campaign already sent", async () => {
            const campaignId = await draftWithMembers();
            await admin().sendCampaign({ organizationId: T.org, campaignId });
            vi.mocked(sendEmail).mockClear();

            await expect(
                admin().sendCampaign({ organizationId: T.org, campaignId }),
            ).rejects.toMatchObject({ code: "CONFLICT" });
            expect(sendEmail).not.toHaveBeenCalled();
        });

        it("is BAD_REQUEST for a Draft with no members", async () => {
            const { campaignId } = await admin().createCampaign(create);
            await expect(
                admin().sendCampaign({ organizationId: T.org, campaignId }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        });

        it("refuses an org owner without the system admin role", async () => {
            const campaignId = await draftWithMembers();
            await expect(
                owner().sendCampaign({ organizationId: T.org, campaignId }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
            expect(sendEmail).not.toHaveBeenCalled();
        });

        it("is PRECONDITION_FAILED without a personal D4H token", async () => {
            const campaignId = await draftWithMembers();
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No personal D4H access token."),
            );
            await expect(
                admin().sendCampaign({ organizationId: T.org, campaignId }),
            ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
            expect(sendEmail).not.toHaveBeenCalled();
        });
    });

    describe("resendRequest", () => {
        /** A sent campaign's requests, by member name. */
        async function sentRequests() {
            const campaignId = await draftWithMembers();
            await admin().sendCampaign({ organizationId: T.org, campaignId });
            const campaign = await admin().getCampaign({ organizationId: T.org, campaignId });
            vi.mocked(sendEmail).mockClear();
            const byName = Object.fromEntries(
                campaign.requests.map((request) => [request.memberName, request]),
            );
            return { campaignId, john: byName["John Smith"]!, ana: byName["Ana Lee"]! };
        }

        it("resends the link and returns the outcome with its self audit campaign", async () => {
            const { campaignId, john } = await sentRequests();

            const result = await admin().resendRequest({
                organizationId: T.org,
                requestId: john.id,
            });

            expect(result).toEqual({ campaignId, deliveryStatus: "Sent" });
            expect(sendEmail).toHaveBeenCalledTimes(1);
            expect(sendEmail).toHaveBeenCalledWith(
                expect.objectContaining({ to: "john@example.com" }),
            );
        });

        it("is BAD_REQUEST for a member with no email", async () => {
            const { ana } = await sentRequests();

            await expect(
                admin().resendRequest({ organizationId: T.org, requestId: ana.id }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
            expect(sendEmail).not.toHaveBeenCalled();
        });

        it("is NOT_FOUND for a request outside the org", async () => {
            await expect(
                admin().resendRequest({
                    organizationId: T.org,
                    requestId: SelfAuditRequestId.create(),
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        it("refuses an org owner without the system admin role", async () => {
            const { john } = await sentRequests();

            await expect(
                owner().resendRequest({ organizationId: T.org, requestId: john.id }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
            expect(sendEmail).not.toHaveBeenCalled();
        });

        it("is BAD_REQUEST for a withdrawn member", async () => {
            const { john } = await sentRequests();
            await admin().withdrawRequest({ organizationId: T.org, requestId: john.id });

            await expect(
                admin().resendRequest({ organizationId: T.org, requestId: john.id }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
            expect(sendEmail).not.toHaveBeenCalled();
        });
    });

    describe("members", () => {
        it("lists who can be added, and adds them to a Draft without mailing", async () => {
            const { campaignId } = await admin().createCampaign(create);

            const addable = await admin().listAddableMembers({ organizationId: T.org, campaignId });
            expect(addable.map((m) => [m.d4hMemberId, m.email, m.withdrawnRequestId])).toEqual([
                [43, null, null],
                [42, "john@example.com", null],
            ]);

            const result = await admin().addMembers({
                organizationId: T.org,
                campaignId,
                d4hMemberIds: [42, 43],
            });
            expect(result).toEqual({ campaignId, added: 2, sent: 0, failed: 0, noEmail: 1 });
            expect(sendEmail).not.toHaveBeenCalled();
            const campaign = await admin().getCampaign({ organizationId: T.org, campaignId });
            expect(campaign.requests.map((r) => [r.memberName, r.status])).toEqual([
                ["Ana Lee", "NoEmail"],
                ["John Smith", "Unsent"],
            ]);
        });

        it("is BAD_REQUEST to add a member already in the campaign", async () => {
            const campaignId = await draftWithMembers();
            await expect(
                admin().addMembers({ organizationId: T.org, campaignId, d4hMemberIds: [42] }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        });

        it("removes a Draft's member, and withdraws a sent one", async () => {
            const campaignId = await draftWithMembers();
            const draft = await admin().getCampaign({ organizationId: T.org, campaignId });
            const [ana, john] = draft.requests;

            expect(
                await admin().removeRequest({ organizationId: T.org, requestId: ana!.id }),
            ).toEqual({ campaignId });
            await expect(
                admin().withdrawRequest({ organizationId: T.org, requestId: john!.id }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });

            await admin().sendCampaign({ organizationId: T.org, campaignId });
            expect(
                await admin().withdrawRequest({ organizationId: T.org, requestId: john!.id }),
            ).toEqual({ campaignId });
            await expect(
                admin().removeRequest({ organizationId: T.org, requestId: john!.id }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });

            const sent = await admin().getCampaign({ organizationId: T.org, campaignId });
            expect(sent.requests).toEqual([
                expect.objectContaining({ memberName: "John Smith", status: "Withdrawn" }),
            ]);
            expect(sent.requests[0]!.withdrawnAt).not.toBeNull();
            expect(sent.counts.Withdrawn).toBe(1);
        });

        it("discards a Draft, but not a sent campaign", async () => {
            const draftId = await draftWithMembers();
            expect(
                await admin().discardCampaign({ organizationId: T.org, campaignId: draftId }),
            ).toEqual({ campaignId: draftId });
            await expect(
                admin().getCampaign({ organizationId: T.org, campaignId: draftId }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });

            const sentId = await draftWithMembers();
            await admin().sendCampaign({ organizationId: T.org, campaignId: sentId });
            await expect(
                admin().discardCampaign({ organizationId: T.org, campaignId: sentId }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        });

        it("is PRECONDITION_FAILED to list or add without a personal D4H token", async () => {
            const campaignId = await draftWithMembers();
            vi.mocked(getConfiguredD4HAccessToken).mockRejectedValue(
                new NotConfiguredError("No personal D4H access token."),
            );
            await expect(
                admin().listAddableMembers({ organizationId: T.org, campaignId }),
            ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
            await expect(
                admin().addMembers({ organizationId: T.org, campaignId, d4hMemberIds: [42] }),
            ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
        });

        it("refuses an org owner without the system admin role", async () => {
            const campaignId = await draftWithMembers();
            const requestId = (await admin().getCampaign({ organizationId: T.org, campaignId }))
                .requests[0]!.id;
            for (const call of [
                () => owner().listAddableMembers({ organizationId: T.org, campaignId }),
                () => owner().addMembers({ organizationId: T.org, campaignId, d4hMemberIds: [42] }),
                () => owner().removeRequest({ organizationId: T.org, requestId }),
                () => owner().withdrawRequest({ organizationId: T.org, requestId }),
                () => owner().discardCampaign({ organizationId: T.org, campaignId }),
            ]) {
                await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
            }
        });
    });
});
