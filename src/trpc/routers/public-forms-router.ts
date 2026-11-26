/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { checkBotId } from "botid/server";
import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { JacketInterestRow, JacketInterestSubmission } from "@/lib/schemas/jacket-interest";
import {
    KitCheckHeldItem,
    KitCheckResponseData,
    KitCheckTemplate,
    kitCheckTokenSchema,
} from "@/lib/schemas/kit-check";
import * as KitCheckPublic from "@/server/services/kit-check-public";
import * as PublicForms from "@/server/services/public-forms";

import { createTrpcRouter, organizationProcedure, publicProcedure } from "../init";

/**
 * Refuse a request BotID judges a bot's.
 * @throws TRPCError(FORBIDDEN) if it does.
 */
async function assertNotBot(): Promise<void> {
    const verification = await checkBotId();
    if (verification.isBot) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "Your answer couldn't be accepted. Please try again in a browser.",
        });
    }
}

/**
 * What an anonymous caller may read through a kit-check link, and nothing more: an object schema
 * strips any field a later change adds to the service's result.
 */
const KitCheckByTokenOutput = z.discriminatedUnion("state", [
    z.object({ state: z.literal("not-found") }),
    z.object({
        state: z.literal("ok"),
        subject: z.object({
            memberName: z.string(),
            teamName: z.string(),
            bundleName: z.string(),
            requestedBy: z.string(),
        }),
        templates: z.array(KitCheckTemplate),
        heldItems: z.array(KitCheckHeldItem),
        formData: KitCheckResponseData,
        formStatus: z.enum(["Draft", "Submitted"]),
        submittedData: KitCheckResponseData.nullable(),
        submittedAt: z.date().nullable(),
        expiresAt: z.date(),
    }),
]) satisfies z.ZodType<KitCheckPublic.KitCheckByToken>;

const kitCheckTokenInput = z.object({ token: kitCheckTokenSchema });
const kitCheckAnswerInput = kitCheckTokenInput.extend({ formData: KitCheckResponseData });

/**
 * Forms anyone with the link can answer without an account (`/forms/*`, `src/lib/public-forms.ts`).
 * Answers are stored as Submitted `FormInstance`s in the form's organisation; its admins read
 * them back. Submits are checked with Vercel BotID: the paths are tagged on the client in
 * `src/instrumentation-client.ts` (`PUBLIC_FORM_BOT_PROTECTED_PATHS`).
 *
 * The kit check's procedures (`…KitCheck…ByToken`) are reached through a per-member emailed link
 * instead: the token finds the organisation and the request (`src/server/services/kit-check-public.ts`).
 * Unknown, replaced and expired tokens all read as `not-found`, and the writes refuse them with
 * NOT_FOUND "This link has expired or isn't valid."
 */
export const publicFormsRouter = createTrpcRouter({
    /**
     * The member's kit-check form for a link token: `{ state: "not-found" }`, or who it's for, what
     * they're asked and their answers so far. Reads only: opening the link changes nothing.
     */
    getKitCheckByToken: publicProcedure
        .input(kitCheckTokenInput)
        .output(KitCheckByTokenOutput)
        .query(async ({ ctx, input: { token } }) => {
            return await KitCheckPublic.getKitCheckByToken(ctx, token);
        }),

    /**
     * Every answer to the soft shell jacket form in the organisation, oldest first. Org admins.
     */
    listJacketInterest: organizationProcedure({ organization: ["update"] })
        .output(z.array(JacketInterestRow))
        .query(async ({ ctx }) => {
            return await PublicForms.listJacketInterest(ctx);
        }),

    /**
     * Record that the member opened their kit-check form (`openedAt`, if unset). Idempotent.
     * @throws TRPCError(NOT_FOUND) if the link has expired or isn't valid.
     */
    openKitCheckByToken: publicProcedure
        .input(kitCheckTokenInput)
        .mutation(async ({ ctx, input: { token } }) => {
            await KitCheckPublic.openKitCheckByToken(ctx, token);
            return { opened: true as const };
        }),

    /**
     * Send a submitted kit check back to Draft, so the member can change their answers. The last
     * submitted answers stand until they submit again.
     * @throws TRPCError(NOT_FOUND) if the link has expired or isn't valid.
     */
    reopenKitCheckByToken: publicProcedure
        .input(kitCheckTokenInput)
        .mutation(async ({ ctx, input: { token } }) => {
            await KitCheckPublic.reopenKitCheckByToken(ctx, token);
            return { reopened: true as const };
        }),

    /**
     * Autosave the member's kit-check answers. Not checked with BotID: it fires often, and the
     * token already gates it.
     * @throws TRPCError(NOT_FOUND) if the link has expired or isn't valid.
     * @throws TRPCError(CONFLICT) if the form has been submitted.
     */
    saveKitCheckDraftByToken: publicProcedure
        .input(kitCheckAnswerInput)
        .mutation(async ({ ctx, input: { token, formData } }) => {
            await KitCheckPublic.saveKitCheckDraftByToken(ctx, token, formData);
            return { saved: true as const };
        }),

    /**
     * Store one answer to the soft shell jacket form.
     * @throws TRPCError(FORBIDDEN) if BotID judges the request a bot's.
     * @throws TRPCError(PRECONDITION_FAILED) if the form's organisation doesn't exist.
     */
    submitJacketInterest: publicProcedure
        .input(JacketInterestSubmission)
        .mutation(async ({ ctx, input }) => {
            await assertNotBot();
            await PublicForms.submitJacketInterest(ctx, input);
            return { stored: true as const };
        }),

    /**
     * Submit the member's kit-check answers.
     * @throws TRPCError(FORBIDDEN) if BotID judges the request a bot's.
     * @throws TRPCError(NOT_FOUND) if the link has expired or isn't valid.
     * @throws TRPCError(BAD_REQUEST) if something the form asks is unanswered.
     * @throws TRPCError(CONFLICT) if the form has already been submitted.
     */
    submitKitCheckByToken: publicProcedure
        .input(kitCheckAnswerInput)
        .mutation(async ({ ctx, input: { token, formData } }) => {
            await assertNotBot();
            await KitCheckPublic.submitKitCheckByToken(ctx, token, formData);
            return { submitted: true as const };
        }),
});
