/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { addDays } from "date-fns";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { NOT_NEEDED, OTHER_VARIANT } from "@/lib/kit-check-types";
import { ANY_VARIANT, EMPTY_ANSWER } from "@/lib/kit-check-validate";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import {
    KitCheckId,
    KitCheckRequestId,
    type KitCheckHeldItem,
    type KitCheckResponseData,
    type KitCheckTemplate,
    type KitCheckTemplatesByTeam,
} from "@/lib/schemas/kit-check";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { hashLinkToken } from "@/server/link-token";
import { createMockPrisma } from "@/test/create-prisma-mock";

import {
    assertKnownKitCheckVariants,
    getKitCheckByToken,
    isKitCheckComplete,
    LINK_NOT_VALID,
    openKitCheckByToken,
    reopenKitCheckByToken,
    saveKitCheckDraftByToken,
    submitKitCheckByToken,
} from "./kit-check-public";

const TEAM_ID = 7;

const helmet: KitCheckTemplate = {
    id: "helmet",
    category: "PPE",
    name: "Helmet",
    variants: [],
    requireSN: false,
    sized: true,
    sizeOptional: true,
    sizeOptions: [],
};

const gloves: KitCheckTemplate = { ...helmet, id: "gloves", name: "Gloves" };

const heldHelmet: KitCheckHeldItem = {
    id: "1001",
    templateId: helmet.id,
    description: "Petzl Vertex",
    serial: null,
    variantId: null,
    problems: [],
};

/** The pre-filled answer: the held helmet Yes, the missing gloves unanswered. */
const prefilled: KitCheckResponseData = {
    held: { [heldHelmet.id]: { ...EMPTY_ANSWER, has: "yes" } },
    missing: {},
    extras: [],
    comments: "",
};

/** A complete answer: the helmet held, no gloves and none needed. */
const complete: KitCheckResponseData = {
    ...prefilled,
    missing: { [gloves.id]: { ...EMPTY_ANSWER, has: "no", wantVariantId: NOT_NEEDED } },
    comments: "All good",
};

describe("isKitCheckComplete", () => {
    it("needs every held item and every missing template answered", () => {
        expect(isKitCheckComplete(prefilled, [helmet, gloves], [heldHelmet])).toBe(false);
        expect(isKitCheckComplete(complete, [helmet, gloves], [heldHelmet])).toBe(true);
    });

    it("counts Not sure as answered", () => {
        const unsure: KitCheckResponseData = {
            ...prefilled,
            held: { [heldHelmet.id]: { ...EMPTY_ANSWER, has: "unsure" } },
            missing: { [gloves.id]: { ...EMPTY_ANSWER, has: "unsure" } },
        };
        expect(isKitCheckComplete(unsure, [helmet, gloves], [heldHelmet])).toBe(true);
    });

    it("asks a No what they want", () => {
        const noWant: KitCheckResponseData = {
            ...prefilled,
            missing: { [gloves.id]: { ...EMPTY_ANSWER, has: "no" } },
        };
        expect(isKitCheckComplete(noWant, [helmet, gloves], [heldHelmet])).toBe(false);
    });
});

describe("assertKnownKitCheckVariants", () => {
    const sizedGloves: KitCheckTemplate = {
        ...gloves,
        variants: [{ id: "nitrile", label: "Nitrile" }],
    };
    const templates = [helmet, sizedGloves];
    const withGloves = (answer: { wantVariantId: string }): KitCheckResponseData => ({
        ...complete,
        missing: { [gloves.id]: { ...EMPTY_ANSWER, has: "no", ...answer } },
    });

    it("accepts the template's own variants and the form's choices", () => {
        for (const wantVariantId of ["nitrile", OTHER_VARIANT, ANY_VARIANT, NOT_NEEDED, ""]) {
            expect(() =>
                assertKnownKitCheckVariants(withGloves({ wantVariantId }), templates, [heldHelmet]),
            ).not.toThrow();
        }
    });

    it("refuses a variant id the template doesn't offer", () => {
        expect(() =>
            assertKnownKitCheckVariants(withGloves({ wantVariantId: "leather" }), templates, [
                heldHelmet,
            ]),
        ).toThrow(ValidationError);
        expect(() =>
            assertKnownKitCheckVariants(
                {
                    ...complete,
                    held: {
                        [heldHelmet.id]: { ...EMPTY_ANSWER, has: "yes", variantId: "nitrile" },
                    },
                },
                templates,
                [heldHelmet],
            ),
        ).toThrow(ValidationError);
    });
});

describe("kit check by token", () => {
    const S = {
        org: OrganizationId.create(),
        sender: UserId.create(),
        check: KitCheckId.create(),
        orphanCheck: KitCheckId.create(),
    };
    const db = createMockPrisma();
    const ctx = { prisma: db };
    let seeded = 0;

    beforeAll(async () => {
        await db.organization.create({
            data: { id: S.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.user.create({
            data: {
                id: S.sender,
                name: "Ana Admin",
                email: "ana.admin@example.com",
                emailVerified: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
        const templates: KitCheckTemplatesByTeam = {
            [String(TEAM_ID)]: [helmet, gloves],
            "8": [{ ...helmet, id: "other-team-only" }],
        };
        for (const [id, sentById] of [
            [S.check, S.sender],
            [S.orphanCheck, null],
        ] as const) {
            await db.kitCheck.create({
                data: {
                    id,
                    organizationId: S.org,
                    bundleName: "Responder",
                    d4hTeams: [{ id: TEAM_ID, title: "Rescue Team" }],
                    templates,
                    sentById,
                },
            });
        }
    });

    /** A fresh request, sent, with a live link unless told otherwise. */
    async function seedRequest({
        kitCheckId = S.check,
        expiresAt = addDays(new Date(), 14),
    }: { kitCheckId?: KitCheckId; expiresAt?: Date } = {}) {
        seeded++;
        const token = `token-${seeded}-${Math.random()}`;
        const id = KitCheckRequestId.create();
        const formInstanceId = FormInstanceId.create();
        await db.formInstance.create({
            data: {
                id: formInstanceId,
                formKey: "kit-check",
                organizationId: S.org,
                userId: null,
                formData: prefilled,
                formStatus: "Draft",
            },
        });
        await db.kitCheckRequest.create({
            data: {
                id,
                organizationId: S.org,
                kitCheckId,
                d4hTeamId: TEAM_ID,
                d4hTeamTitle: "Rescue Team",
                d4hMemberId: 1000 + seeded,
                memberName: "John Smith",
                email: "john@example.com",
                heldItems: [heldHelmet],
                tokenHash: hashLinkToken(token),
                expiresAt,
                deliveryStatus: "Sent",
                sentAt: new Date(),
                formInstanceId,
            },
        });
        return { token, id, formInstanceId };
    }

    const readRequest = (id: KitCheckRequestId) =>
        db.kitCheckRequest.findUniqueOrThrow({ where: { id }, include: { formInstance: true } });

    describe("a token that finds no live request", () => {
        async function expectNotFound(token: string) {
            expect(await getKitCheckByToken(ctx, token)).toEqual({ state: "not-found" });
            for (const call of [
                () => openKitCheckByToken(ctx, token),
                () => saveKitCheckDraftByToken(ctx, token, complete),
                () => submitKitCheckByToken(ctx, token, complete),
                () => reopenKitCheckByToken(ctx, token),
            ]) {
                const error = await call().catch((caught: unknown) => caught);
                expect(error).toBeInstanceOf(NotFoundError);
                expect((error as Error).message).toBe(LINK_NOT_VALID);
            }
        }

        it("is not-found when unknown", async () => {
            await expectNotFound("no-such-token");
        });

        it("is not-found once replaced", async () => {
            const { token, id } = await seedRequest();
            await db.kitCheckRequest.update({
                where: { id },
                data: { tokenHash: hashLinkToken("a-newer-token") },
            });
            await expectNotFound(token);
        });

        it("is not-found once expired", async () => {
            const { token } = await seedRequest({ expiresAt: new Date(Date.now() - 1000) });
            await expectNotFound(token);
        });
    });

    it("reads the subject, the team's snapshot and the answers, and changes nothing", async () => {
        const { token, id } = await seedRequest();

        const form = await getKitCheckByToken(ctx, token);

        expect(form).toEqual({
            state: "ok",
            subject: {
                memberName: "John Smith",
                teamName: "Rescue Team",
                bundleName: "Responder",
                requestedBy: "Ana Admin",
            },
            templates: [helmet, gloves],
            heldItems: [heldHelmet],
            formData: prefilled,
            formStatus: "Draft",
            submittedData: null,
            submittedAt: null,
            expiresAt: expect.any(Date),
        });
        expect(JSON.stringify(form)).not.toContain("john@example.com");
        expect((await readRequest(id)).openedAt).toBeNull();
    });

    it("names the team equipment officer when the sender is gone", async () => {
        const { token } = await seedRequest({ kitCheckId: S.orphanCheck });
        expect(await getKitCheckByToken(ctx, token)).toMatchObject({
            subject: { requestedBy: "the team equipment officer" },
        });
    });

    it("stamps openedAt once on open", async () => {
        const { token, id } = await seedRequest();

        await openKitCheckByToken(ctx, token);
        const { openedAt } = await readRequest(id);
        expect(openedAt).toBeInstanceOf(Date);

        await openKitCheckByToken(ctx, token);
        expect((await readRequest(id)).openedAt).toEqual(openedAt);
    });

    it("saves the draft and stamps openedAt, without logging", async () => {
        const { token, id } = await seedRequest();

        await saveKitCheckDraftByToken(ctx, token, complete);

        const after = await readRequest(id);
        expect(after.openedAt).toBeInstanceOf(Date);
        expect(after.formInstance).toMatchObject({ formStatus: "Draft", formData: complete });
        expect(await db.logEntry.count({ where: { objectId: id } })).toBe(0);
    });

    it("refuses an incomplete submit", async () => {
        const { token, id } = await seedRequest();

        await expect(submitKitCheckByToken(ctx, token, prefilled)).rejects.toBeInstanceOf(
            ValidationError,
        );
        expect((await readRequest(id)).formInstance.formStatus).toBe("Draft");
    });

    it("submits: the answers become the submitted answer, logged as the member", async () => {
        const { token, id } = await seedRequest();
        const before = Date.now();

        await submitKitCheckByToken(ctx, token, complete);

        const after = await readRequest(id);
        expect(after).toMatchObject({ submittedData: complete });
        expect(after.submittedAt!.getTime()).toBeGreaterThanOrEqual(before);
        expect(after.openedAt).toBeInstanceOf(Date);
        expect(after.formInstance).toMatchObject({ formStatus: "Submitted", formData: complete });

        const entries = await db.logEntry.findMany({ where: { objectId: id } });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            action: "Update",
            objectType: "KitCheckRequest",
            organizationId: S.org,
            actorLabel: "John Smith (Rescue Team)",
            description: "Kit check submitted by John Smith (Rescue Team)",
        });
        const batch = await db.logBatch.findUniqueOrThrow({ where: { id: entries[0].batchId! } });
        expect(batch).toMatchObject({
            operationKey: "public-form-submission",
            actorLabel: "John Smith (Rescue Team)",
        });
    });

    it("refuses a submit naming a variant the template doesn't offer", async () => {
        const { token, id } = await seedRequest();
        const unknown: KitCheckResponseData = {
            ...complete,
            missing: { [gloves.id]: { ...EMPTY_ANSWER, has: "no", wantVariantId: "made-up" } },
        };

        await expect(submitKitCheckByToken(ctx, token, unknown)).rejects.toBeInstanceOf(
            ValidationError,
        );
        expect((await readRequest(id)).formInstance.formStatus).toBe("Draft");
    });

    it('submits "Not sure" answers, and stores them', async () => {
        const { token, id } = await seedRequest();
        const unsure: KitCheckResponseData = {
            ...complete,
            held: { [heldHelmet.id]: { ...EMPTY_ANSWER, has: "unsure", notes: "Lent it out" } },
            missing: { [gloves.id]: { ...EMPTY_ANSWER, has: "unsure" } },
        };

        await submitKitCheckByToken(ctx, token, unsure);

        const after = await readRequest(id);
        expect(after).toMatchObject({ submittedData: unsure });
        expect(after.formInstance).toMatchObject({ formStatus: "Submitted", formData: unsure });
    });

    it("refuses a save after submit", async () => {
        const { token, id } = await seedRequest();
        await submitKitCheckByToken(ctx, token, complete);

        await expect(saveKitCheckDraftByToken(ctx, token, prefilled)).rejects.toBeInstanceOf(
            ConflictError,
        );
        expect((await readRequest(id)).formInstance.formData).toEqual(complete);
    });

    it("refuses a second submit, writing no log", async () => {
        const { token, id } = await seedRequest();
        await submitKitCheckByToken(ctx, token, complete);

        await expect(submitKitCheckByToken(ctx, token, complete)).rejects.toBeInstanceOf(
            ConflictError,
        );
        expect(await db.logEntry.count({ where: { objectId: id } })).toBe(1);
    });

    it("refuses a second submit as a conflict even when it's incomplete", async () => {
        const { token } = await seedRequest();
        await submitKitCheckByToken(ctx, token, complete);

        await expect(submitKitCheckByToken(ctx, token, prefilled)).rejects.toBeInstanceOf(
            ConflictError,
        );
    });

    it("stores only answers to what the member was asked, Not sure included", async () => {
        const { token, id } = await seedRequest();
        const padded: KitCheckResponseData = {
            held: {
                [heldHelmet.id]: { ...EMPTY_ANSWER, has: "unsure" },
                // Not one of their held items.
                "9999": { ...EMPTY_ANSWER, has: "yes" },
            },
            missing: {
                [gloves.id]: { ...EMPTY_ANSWER, has: "unsure" },
                // They hold a helmet, so it isn't missing; and another team's template.
                [helmet.id]: { ...EMPTY_ANSWER, has: "no", wantVariantId: NOT_NEEDED },
                "other-team-only": { ...EMPTY_ANSWER, has: "no", wantVariantId: NOT_NEEDED },
            },
            extras: [
                { id: "1", item: "Head torch", kind: "have", size: "", notes: "" },
                { id: "2", item: "   ", kind: "need", size: "", notes: "" },
            ],
            comments: "All good",
        };

        await submitKitCheckByToken(ctx, token, padded);

        const expected: KitCheckResponseData = {
            held: { [heldHelmet.id]: { ...EMPTY_ANSWER, has: "unsure" } },
            missing: { [gloves.id]: { ...EMPTY_ANSWER, has: "unsure" } },
            extras: [{ id: "1", item: "Head torch", kind: "have", size: "", notes: "" }],
            comments: "All good",
        };
        const after = await readRequest(id);
        expect(after.submittedData).toEqual(expected);
        expect(after.formInstance.formData).toEqual(expected);
    });

    it("rolls a submit that loses the race back, log entry included", async () => {
        const { token, id, formInstanceId } = await seedRequest();
        const submittedElsewhere: KitCheckResponseData = { ...complete, comments: "Other tab" };
        // The other tab's submit lands between this one's lookup (which saw a Draft) and its write.
        const findFirst = db.kitCheckRequest.findFirst.bind(db.kitCheckRequest);
        const spy = vi.spyOn(db.kitCheckRequest, "findFirst").mockImplementationOnce((async (
            args: Parameters<typeof findFirst>[0],
        ) => {
            const found = await findFirst(args);
            await db.formInstance.update({
                where: { id: formInstanceId },
                data: { formStatus: "Submitted", formData: submittedElsewhere },
            });
            return found;
        }) as unknown as typeof findFirst);
        try {
            await expect(submitKitCheckByToken(ctx, token, complete)).rejects.toBeInstanceOf(
                ConflictError,
            );
        } finally {
            spy.mockRestore();
        }

        const after = await readRequest(id);
        expect(after).toMatchObject({ submittedData: null, submittedAt: null });
        expect(after.formInstance.formData).toEqual(submittedElsewhere);
        expect(await db.logEntry.count({ where: { objectId: id } })).toBe(0);
    });

    it("reopens keeping the submitted answer, and a resubmit replaces it", async () => {
        const { token, id } = await seedRequest();
        await submitKitCheckByToken(ctx, token, complete);
        const first = await readRequest(id);

        await reopenKitCheckByToken(ctx, token);

        const reopened = await readRequest(id);
        expect(reopened).toMatchObject({
            submittedData: complete,
            submittedAt: first.submittedAt,
        });
        expect(reopened.formInstance.formStatus).toBe("Draft");
        expect(await getKitCheckByToken(ctx, token)).toMatchObject({
            formStatus: "Draft",
            submittedData: complete,
        });
        const entries = await db.logEntry.findMany({
            where: { objectId: id },
            orderBy: { sequence: "asc" },
        });
        expect(entries.map((entry) => entry.description)).toEqual([
            "Kit check submitted by John Smith (Rescue Team)",
            "Kit check reopened by John Smith (Rescue Team)",
        ]);

        // A reopen of a Draft is a no-op.
        await reopenKitCheckByToken(ctx, token);
        expect(await db.logEntry.count({ where: { objectId: id } })).toBe(2);

        const changed: KitCheckResponseData = { ...complete, comments: "Changed my mind" };
        await saveKitCheckDraftByToken(ctx, token, changed);
        await new Promise((resolve) => setTimeout(resolve, 5));
        await submitKitCheckByToken(ctx, token, changed);

        const resubmitted = await readRequest(id);
        expect(resubmitted.submittedData).toEqual(changed);
        expect(resubmitted.submittedAt!.getTime()).toBeGreaterThan(first.submittedAt!.getTime());
        expect(resubmitted.formInstance.formStatus).toBe("Submitted");
    });
});
