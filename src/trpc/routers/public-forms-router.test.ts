/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { checkBotId } from "botid/server";
import { addDays } from "date-fns";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NOT_NEEDED } from "@/lib/kit-check-types";
import { EMPTY_ANSWER } from "@/lib/kit-check-validate";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import {
    KitCheckId,
    KitCheckRequestId,
    type KitCheckResponseData,
    type KitCheckTemplate,
} from "@/lib/schemas/kit-check";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { hashLinkToken } from "@/server/link-token";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { publicFormsRouter } from "./public-forms-router";

vi.mock("botid/server", () => ({
    checkBotId: vi.fn(),
}));

const TEAM_ID = 7;

const gloves: KitCheckTemplate = {
    id: "gloves",
    category: "PPE",
    name: "Gloves",
    variants: [],
    requireSN: false,
    sized: true,
    sizeOptional: true,
    sizeOptions: [],
};

const unanswered: KitCheckResponseData = { held: {}, missing: {}, extras: [], comments: "" };
const complete: KitCheckResponseData = {
    ...unanswered,
    missing: { [gloves.id]: { ...EMPTY_ANSWER, has: "no", wantVariantId: NOT_NEEDED } },
};

describe("publicFormsRouter kit check", () => {
    const S = { org: OrganizationId.create(), check: KitCheckId.create() };
    const db = createMockPrisma();
    let seeded = 0;

    beforeAll(async () => {
        await db.organization.create({
            data: { id: S.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.kitCheck.create({
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
        const id = KitCheckRequestId.create();
        const formInstanceId = FormInstanceId.create();
        await db.formInstance.create({
            data: {
                id: formInstanceId,
                formKey: "kit-check",
                organizationId: S.org,
                userId: null,
                formData: unanswered,
                formStatus: "Draft",
            },
        });
        await db.kitCheckRequest.create({
            data: {
                id,
                organizationId: S.org,
                kitCheckId: S.check,
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
        expect(await caller.getKitCheckByToken({ token })).toEqual({ state: "not-found" });
        for (const call of [
            () => caller.openKitCheckByToken({ token }),
            () => caller.saveKitCheckDraftByToken({ token, formData: complete }),
            () => caller.submitKitCheckByToken({ token, formData: complete }),
            () => caller.reopenKitCheckByToken({ token }),
        ]) {
            await expect(call()).rejects.toMatchObject({
                code: "NOT_FOUND",
                message: "This link has expired or isn't valid.",
            });
        }
    });

    it("refuses an answer that isn't a kit-check answer", async () => {
        const { token } = await seedRequest();
        const own = { ...complete.missing[gloves.id], has: "own" };
        await expect(
            anonymous().saveKitCheckDraftByToken({
                token,
                formData: { ...complete, missing: { [gloves.id]: own } } as never,
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("refuses an incomplete submit BAD_REQUEST", async () => {
        const { token } = await seedRequest();
        await expect(
            anonymous().submitKitCheckByToken({ token, formData: unanswered }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("refuses a bot's submit FORBIDDEN, storing nothing", async () => {
        vi.mocked(checkBotId).mockResolvedValue({ isBot: true } as Awaited<
            ReturnType<typeof checkBotId>
        >);
        const { token, id } = await seedRequest();

        await expect(
            anonymous().submitKitCheckByToken({ token, formData: complete }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(await db.kitCheckRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({
            submittedAt: null,
        });
    });

    it("saves, submits, refuses a later save CONFLICT, and reopens", async () => {
        const caller = anonymous();
        const { token } = await seedRequest();

        await caller.openKitCheckByToken({ token });
        await caller.saveKitCheckDraftByToken({ token, formData: complete });
        await caller.submitKitCheckByToken({ token, formData: complete });
        expect(await caller.getKitCheckByToken({ token })).toMatchObject({
            state: "ok",
            formStatus: "Submitted",
            submittedData: complete,
        });

        await expect(
            caller.saveKitCheckDraftByToken({ token, formData: unanswered }),
        ).rejects.toMatchObject({ code: "CONFLICT" });

        await caller.reopenKitCheckByToken({ token });
        expect(await caller.getKitCheckByToken({ token })).toMatchObject({
            formStatus: "Draft",
            submittedData: complete,
        });
    });
});
