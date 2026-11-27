/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { checkBotId } from "botid/server";
import { addDays } from "date-fns";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { FormInstanceId } from "@/lib/schemas/form-instance";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    SelfAuditCampaignId,
    SelfAuditRequestId,
    type SelfAuditResponseData,
    type SelfAuditTemplate,
} from "@/lib/schemas/self-audit";
import { UserId } from "@/lib/schemas/user";
import { NOT_NEEDED } from "@/lib/self-audit-types";
import { EMPTY_ANSWER } from "@/lib/self-audit-validate";
import { hashLinkToken } from "@/server/link-token";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { publicFormsRouter } from "./public-forms-router";

vi.mock("botid/server", () => ({
    checkBotId: vi.fn(),
}));

const TEAM_ID = 7;

const gloves: SelfAuditTemplate = {
    id: "gloves",
    category: "PPE",
    name: "Gloves",
    variants: [],
    requireSN: false,
    sized: true,
    sizeOptional: true,
    sizeOptions: [],
};

const unanswered: SelfAuditResponseData = { held: {}, missing: {}, extras: [], comments: "" };
const complete: SelfAuditResponseData = {
    ...unanswered,
    missing: { [gloves.id]: { ...EMPTY_ANSWER, has: "no", wantVariantId: NOT_NEEDED } },
};

describe("publicFormsRouter self-audit", () => {
    const S = { org: OrganizationId.create(), check: SelfAuditCampaignId.create() };
    const db = createMockPrisma();
    let seeded = 0;

    beforeAll(async () => {
        await db.organization.create({
            data: { id: S.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.selfAuditCampaign.create({
            data: {
                id: S.check,
                organizationId: S.org,
                bundleName: "Responder",
                d4hTeams: [{ id: TEAM_ID, title: "Rescue Team" }],
                templates: { [String(TEAM_ID)]: [gloves] },
            },
        });
    });

    beforeEach(() => {
        vi.mocked(checkBotId).mockResolvedValue({ isBot: false } as Awaited<
            ReturnType<typeof checkBotId>
        >);
    });

    /** A fresh request with a live link. */
    async function seedRequest() {
        seeded++;
        const token = `router-token-${seeded}`;
        const id = SelfAuditRequestId.create();
        const formInstanceId = FormInstanceId.create();
        await db.formInstance.create({
            data: {
                id: formInstanceId,
                formKey: "d4h-i3-self-audit",
                organizationId: S.org,
                userId: null,
                formData: unanswered,
                formStatus: "Draft",
            },
        });
        await db.selfAuditRequest.create({
            data: {
                id,
                organizationId: S.org,
                campaignId: S.check,
                d4hTeamId: TEAM_ID,
                d4hTeamTitle: "Rescue Team",
                d4hMemberId: seeded,
                memberName: "Kim Tan",
                email: "kim@example.com",
                heldItems: [],
                tokenHash: hashLinkToken(token),
                expiresAt: addDays(new Date(), 14),
                deliveryStatus: "Sent",
                formInstanceId,
            },
        });
        return { token, id };
    }

    function anonymous() {
        return publicFormsRouter.createCaller({
            ...createAuthenticatedMockContext({ user: { id: UserId.create() }, prisma: db }),
            auth: null,
        });
    }

    it("answers an unknown token not-found, and refuses its writes NOT_FOUND", async () => {
        const caller = anonymous();
        const token = "no-such-token";
        expect(await caller.getSelfAuditByToken({ slug: "acme", token })).toEqual({
            state: "not-found",
        });
        for (const call of [
            () => caller.openSelfAuditByToken({ slug: "acme", token }),
            () => caller.saveSelfAuditDraftByToken({ slug: "acme", token, formData: complete }),
            () => caller.submitSelfAuditByToken({ slug: "acme", token, formData: complete }),
            () => caller.reopenSelfAuditByToken({ slug: "acme", token }),
        ]) {
            await expect(call()).rejects.toMatchObject({
                code: "NOT_FOUND",
                message: "This link has expired or isn't valid.",
            });
        }
    });

    it("refuses an answer that isn't a self-audit answer", async () => {
        const { token } = await seedRequest();
        const own = { ...complete.missing[gloves.id], has: "own" };
        await expect(
            anonymous().saveSelfAuditDraftByToken({
                slug: "acme",
                token,
                formData: { ...complete, missing: { [gloves.id]: own } } as never,
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("refuses an incomplete submit BAD_REQUEST", async () => {
        const { token } = await seedRequest();
        await expect(
            anonymous().submitSelfAuditByToken({ slug: "acme", token, formData: unanswered }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("refuses a bot's submit FORBIDDEN, storing nothing", async () => {
        vi.mocked(checkBotId).mockResolvedValue({ isBot: true } as Awaited<
            ReturnType<typeof checkBotId>
        >);
        const { token, id } = await seedRequest();

        await expect(
            anonymous().submitSelfAuditByToken({ slug: "acme", token, formData: complete }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(await db.selfAuditRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({
            submittedAt: null,
        });
    });

    it("saves, submits, refuses a later save CONFLICT, and reopens", async () => {
        const caller = anonymous();
        const { token } = await seedRequest();

        await caller.openSelfAuditByToken({ slug: "acme", token });
        await caller.saveSelfAuditDraftByToken({ slug: "acme", token, formData: complete });
        await caller.submitSelfAuditByToken({ slug: "acme", token, formData: complete });
        expect(await caller.getSelfAuditByToken({ slug: "acme", token })).toMatchObject({
            state: "ok",
            formStatus: "Submitted",
            submittedData: complete,
        });

        await expect(
            caller.saveSelfAuditDraftByToken({ slug: "acme", token, formData: unanswered }),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        await caller.reopenSelfAuditByToken({ slug: "acme", token });
        expect(await caller.getSelfAuditByToken({ slug: "acme", token })).toMatchObject({
            formStatus: "Draft",
            submittedData: complete,
        });
    });
});
