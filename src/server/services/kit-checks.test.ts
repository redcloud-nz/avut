/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { ReactElement } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { render } from "@react-email/components";

import { ValidationError } from "@/lib/errors";
import { compareBundle } from "@/lib/i3-bundle-compare";
import { EMPTY_ANSWER } from "@/lib/kit-check-validate";
import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import type { D4HEquipmentListItem } from "@/lib/schemas/d4h/equipment-item";
import { I3BundleId, type I3BundleLine } from "@/lib/schemas/i3-bundle";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import {
    KIT_CHECK_TOKEN_DAYS,
    KitCheckRequestId,
    KitCheckResponseData,
} from "@/lib/schemas/kit-check";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { fetchD4HTeamEquipmentItems } from "@/server/d4h-api/equipment";
import { listFitsForD4HTeam } from "@/server/services/i3-templates";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import {
    buildKitCheckSnapshot,
    createKitCheck,
    resendRequest,
    SEND_SPACING_MS,
    type KitCheckIssuedItem,
    type KitCheckSendDeps,
    type KitCheckVariantSource,
} from "./kit-checks";

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

const variants: KitCheckVariantSource[] = [
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
): KitCheckIssuedItem {
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

function snapshot(items: KitCheckIssuedItem[]) {
    const comparison = compareBundle({
        lines: [harnessLine, glovesLine],
        members,
        items,
        fittingTemplateIds: [T.harness, T.gloves],
    });
    return buildKitCheckSnapshot({
        columns: comparison.columns,
        rows: comparison.rows,
        variants,
        fittingVariantIds,
    });
}

describe("buildKitCheckSnapshot", () => {
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

    it("pre-fills every held item as held, and nothing else", () => {
        const { members: result } = snapshot([item(30, 1, GLOVES_KIND), item(31, 1, GLOVES_KIND)]);

        const { response } = result.find((entry) => entry.member.id === 1)!;
        expect(response).toEqual({
            held: {
                "30": { ...EMPTY_ANSWER, has: "yes" },
                "31": { ...EMPTY_ANSWER, has: "yes" },
            },
            missing: {},
            extras: [],
            comments: "",
        });
        expect(KitCheckResponseData.parse(response)).toEqual(response);
    });
});

describe("createKitCheck", () => {
    const HELMET_KIND = 50;
    const S = {
        org: OrganizationId.create(),
        admin: UserId.create(),
        bundle: I3BundleId.create(),
        helmet: I3TemplateId.create(),
    };
    const db = createMockPrisma();
    const accessToken = { id: "d4h-token-fixture-id" } as unknown as D4HAccessToken_ServerOnly;
    const input = { accessToken, bundleId: S.bundle, d4hTeamIds: [TEAM_ID] };

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
            sendEmail: vi.fn<KitCheckSendDeps["sendEmail"]>(async ({ to }) =>
                failFor.includes(String(to))
                    ? { ok: false as const, error: new Error("Resend said no") }
                    : { ok: true as const },
            ),
            sleep: vi.fn(async () => {}),
            createLinkToken: vi.fn(() => {
                tokens++;
                return { token: `token-${tokens}`, hash: `hash-${tokens}` };
            }),
        } satisfies KitCheckSendDeps;
    }

    beforeAll(async () => {
        await db.organization.create({
            data: { id: S.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
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

    it("creates the check and, per member, a pre-filled draft and a request", async () => {
        const result = await createKitCheck(ctx(), input, makeDeps());

        expect(result).toEqual({ kitCheckId: result.kitCheckId, sent: 2, failed: 0, noEmail: 1 });

        const check = await db.kitCheck.findUniqueOrThrow({ where: { id: result.kitCheckId } });
        expect(check).toMatchObject({
            organizationId: S.org,
            bundleId: S.bundle,
            bundleName: "Responder",
            d4hTeams: [{ id: TEAM_ID, title: "Rescue Team" }],
            sentById: S.admin,
        });
        expect(Object.keys(check.templates as object)).toEqual([String(TEAM_ID)]);

        const requests = await db.kitCheckRequest.findMany({
            where: { kitCheckId: result.kitCheckId },
            include: { formInstance: true },
            orderBy: { d4hMemberId: "asc" },
        });
        expect(requests.map((request) => [request.memberName, request.email])).toEqual([
            ["John Smith", "john@example.com"],
            ["Ana Lee", null],
            ["Kim Tan", "kim@example.com"],
        ]);
        for (const request of requests) {
            expect(request.formInstance).toMatchObject({
                formKey: "kit-check",
                organizationId: S.org,
                userId: null,
                formStatus: "Draft",
            });
        }
        expect(requests[0].formInstance.formData).toMatchObject({
            held: { "1": { ...EMPTY_ANSWER, has: "yes" } },
        });
        expect(requests[0].heldItems).toEqual([
            expect.objectContaining({ id: "1", templateId: S.helmet }),
        ]);
        expect(requests[1].heldItems).toEqual([]);
    });

    it("marks a member with no email NoEmail, and sends the rest their own link", async () => {
        const deps = makeDeps();
        const before = Date.now();
        const { kitCheckId } = await createKitCheck(ctx(), input, deps);

        const requests = await db.kitCheckRequest.findMany({
            where: { kitCheckId },
            orderBy: { d4hMemberId: "asc" },
        });
        expect(requests.map((request) => request.deliveryStatus)).toEqual([
            "Sent",
            "NoEmail",
            "Sent",
        ]);
        expect(requests.map((request) => request.tokenHash)).toEqual(["hash-1", null, "hash-2"]);
        expect(requests[1]).toMatchObject({ sentAt: null, expiresAt: null });

        const days = KIT_CHECK_TOKEN_DAYS * 24 * 60 * 60 * 1000;
        expect(requests[0].sentAt).not.toBeNull();
        expect(requests[0].expiresAt!.getTime()).toBeGreaterThanOrEqual(before + days);
        expect(requests[0].expiresAt!.getTime()).toBeLessThanOrEqual(Date.now() + days);

        expect(deps.sendEmail).toHaveBeenCalledTimes(2);
        expect(deps.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ to: "john@example.com", subject: "Kit check: Responder" }),
        );
        expect(deps.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ to: "kim@example.com" }),
        );
        const html = await render(deps.sendEmail.mock.calls[0][0].react as ReactElement);
        expect(html).toMatch(/href="[^"]*\/forms\/kit-check\/token-1"/);
        expect(html).toContain("Ana Admin");
    });

    it("marks a failed send Failed with no token, and sends the rest", async () => {
        const result = await createKitCheck(ctx(), input, makeDeps(["john@example.com"]));

        expect(result).toMatchObject({ sent: 1, failed: 1, noEmail: 1 });
        const requests = await db.kitCheckRequest.findMany({
            where: { kitCheckId: result.kitCheckId },
            orderBy: { d4hMemberId: "asc" },
        });
        expect(requests[0]).toMatchObject({
            deliveryStatus: "Failed",
            tokenHash: null,
            expiresAt: null,
            sentAt: null,
        });
        expect(requests[2]).toMatchObject({ deliveryStatus: "Sent", tokenHash: "hash-2" });
    });

    it("spaces the sends, not before the first", async () => {
        const deps = makeDeps();
        await createKitCheck(ctx(), input, deps);

        expect(deps.sleep).toHaveBeenCalledTimes(1);
        expect(deps.sleep).toHaveBeenCalledWith(SEND_SPACING_MS);
        const [firstSend, secondSend] = deps.sendEmail.mock.invocationCallOrder;
        expect(deps.sleep.mock.invocationCallOrder[0]).toBeGreaterThan(firstSend);
        expect(deps.sleep.mock.invocationCallOrder[0]).toBeLessThan(secondSend);
    });

    it("logs the check, each request and each send's outcome in one kit-check-send batch", async () => {
        const { kitCheckId } = await createKitCheck(ctx(), input, makeDeps(["kim@example.com"]));

        const requests = await db.kitCheckRequest.findMany({ where: { kitCheckId } });
        const objectIds = [kitCheckId, ...requests.map((request) => request.id)];
        const entries = await db.logEntry.findMany({
            where: { objectId: { in: objectIds } },
            orderBy: { sequence: "asc" },
        });

        const batchIds = [...new Set(entries.map((entry) => entry.batchId))];
        expect(batchIds).toHaveLength(1);
        const batch = await db.logBatch.findUniqueOrThrow({ where: { id: batchIds[0]! } });
        expect(batch).toMatchObject({ operationKey: "kit-check-send", userId: S.admin });

        expect(entries.map((entry) => [entry.action, entry.objectType])).toEqual([
            ["Create", "KitCheck"],
            ["Create", "KitCheckRequest"],
            ["Create", "KitCheckRequest"],
            ["Create", "KitCheckRequest"],
            ["Update", "KitCheckRequest"],
            ["Update", "KitCheckRequest"],
        ]);
        expect(entries.slice(4).map((entry) => entry.description)).toEqual([
            "Kit check sent to John Smith (john@example.com)",
            "Kit check failed to send to Kim Tan (kim@example.com)",
        ]);
    });

    // Shares the fixtures above: each test creates a check, then resends one of its requests.
    describe("resendRequest", () => {
        /** A fresh check, and John's request (sent, as `hash-1`) and Ana's (NoEmail). */
        async function sentCheck() {
            const { kitCheckId } = await createKitCheck(ctx(), input, makeDeps());
            const john = await db.kitCheckRequest.findFirstOrThrow({
                where: { kitCheckId, d4hMemberId: 42 },
                include: { formInstance: true },
            });
            const ana = await db.kitCheckRequest.findFirstOrThrow({
                where: { kitCheckId, d4hMemberId: 43 },
            });
            return {
                kitCheckId,
                john: { ...john, id: KitCheckRequestId.schema.parse(john.id) },
                ana: { ...ana, id: KitCheckRequestId.schema.parse(ana.id) },
            };
        }

        /** Deps whose sends succeed (or all fail), issuing `resent-token`/`resent-hash`. */
        function resendDeps(fail = false) {
            const deps = makeDeps(fail ? ["john@example.com"] : []);
            deps.createLinkToken.mockReturnValue({ token: "resent-token", hash: "resent-hash" });
            return deps;
        }

        it("replaces the token, so the old one no longer resolves, and restarts expiry", async () => {
            const { kitCheckId, john } = await sentCheck();
            const staleExpiry = new Date("2026-01-01T00:00:00Z");
            await db.kitCheckRequest.update({
                where: { id: john.id },
                data: { expiresAt: staleExpiry, sentAt: staleExpiry },
            });

            const deps = resendDeps();
            const before = Date.now();
            const result = await resendRequest(ctx(), john.id, deps);

            expect(result).toEqual({ kitCheckId, deliveryStatus: "Sent" });
            const after = await db.kitCheckRequest.findUniqueOrThrow({ where: { id: john.id } });
            expect(after).toMatchObject({ deliveryStatus: "Sent", tokenHash: "resent-hash" });
            // Every check's tokens are numbered from 1, so look only at this request.
            expect(
                await db.kitCheckRequest.findFirst({
                    where: { id: john.id, tokenHash: john.tokenHash },
                }),
            ).toBeNull();
            const days = KIT_CHECK_TOKEN_DAYS * 24 * 60 * 60 * 1000;
            expect(after.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + days);
            expect(after.sentAt!.getTime()).toBeGreaterThanOrEqual(before);

            expect(deps.sendEmail).toHaveBeenCalledTimes(1);
            const html = await render(deps.sendEmail.mock.calls[0][0].react as ReactElement);
            expect(html).toMatch(/href="[^"]*\/forms\/kit-check\/resent-token"/);

            const entries = await db.logEntry.findMany({
                where: { objectId: john.id, action: "Update" },
                orderBy: { sequence: "asc" },
            });
            const resent = entries.at(-1)!;
            expect(resent.description).toBe("Kit check sent to John Smith (john@example.com)");
            const batch = await db.logBatch.findUniqueOrThrow({ where: { id: resent.batchId! } });
            expect(batch).toMatchObject({ operationKey: "kit-check-send", userId: S.admin });
            expect(resent.batchId).not.toBe(entries[0]!.batchId);
        });

        it("leaves a submitted request's answers and progress alone when the resend fails", async () => {
            const { john } = await sentCheck();
            const openedAt = new Date("2026-11-21T09:00:00Z");
            const submittedAt = new Date("2026-11-22T09:00:00Z");
            const answer = john.formInstance.formData as KitCheckResponseData;
            await db.kitCheckRequest.update({
                where: { id: john.id },
                data: { openedAt, submittedAt, submittedData: answer },
            });
            await db.formInstance.update({
                where: { id: john.formInstanceId },
                data: { formStatus: "Submitted" },
            });

            const result = await resendRequest(ctx(), john.id, resendDeps(true));

            expect(result.deliveryStatus).toBe("Failed");
            const after = await db.kitCheckRequest.findUniqueOrThrow({
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
            expect(after.formInstance).toMatchObject({
                formStatus: "Submitted",
                formData: answer,
            });
        });

        it("resends a request stuck in Pending", async () => {
            const { john } = await sentCheck();
            await db.kitCheckRequest.update({
                where: { id: john.id },
                data: { deliveryStatus: "Pending" },
            });

            const result = await resendRequest(ctx(), john.id, resendDeps());

            expect(result.deliveryStatus).toBe("Sent");
            expect(
                await db.kitCheckRequest.findUniqueOrThrow({ where: { id: john.id } }),
            ).toMatchObject({ deliveryStatus: "Sent", tokenHash: "resent-hash" });
        });

        it("refuses a NoEmail request, sending nothing", async () => {
            const { ana } = await sentCheck();
            const deps = resendDeps();

            await expect(resendRequest(ctx(), ana.id, deps)).rejects.toBeInstanceOf(
                ValidationError,
            );
            expect(deps.sendEmail).not.toHaveBeenCalled();
            expect(
                await db.kitCheckRequest.findUniqueOrThrow({ where: { id: ana.id } }),
            ).toMatchObject({ deliveryStatus: "NoEmail", tokenHash: null });
        });
    });
});
