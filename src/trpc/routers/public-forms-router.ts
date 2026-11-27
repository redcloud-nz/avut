/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { checkBotId } from "botid/server";
import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { JacketInterestRow, JacketInterestSubmission } from "@/lib/schemas/jacket-interest";
import {
    SelfAuditHeldItem,
    SelfAuditResponseData,
    SelfAuditTemplate,
    selfAuditTokenSchema,
} from "@/lib/schemas/self-audit";
import * as PublicForms from "@/server/services/public-forms";
import * as SelfAuditPublic from "@/server/services/self-audit-public";

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
 * What an anonymous caller may read through a self-audit link, and nothing more: an object schema
 * strips any field a later change adds to the service's result.
 */
const SelfAuditByTokenOutput = z.discriminatedUnion("state", [
    z.object({ state: z.literal("not-found") }),
    z.object({
        state: z.literal("ok"),
        subject: z.object({
            memberName: z.string(),
            teamName: z.string(),
            bundleName: z.string(),
            requestedBy: z.string(),
        }),
        templates: z.array(SelfAuditTemplate),
        heldItems: z.array(SelfAuditHeldItem),
        formData: SelfAuditResponseData,
        formStatus: z.enum(["Draft", "Submitted"]),
        submittedData: SelfAuditResponseData.nullable(),
        submittedAt: z.date().nullable(),
        expiresAt: z.date(),
    }),
]) satisfies z.ZodType<SelfAuditPublic.SelfAuditByToken>;

const selfAuditTokenInput = z.object({ token: selfAuditTokenSchema });
const selfAuditAnswerInput = selfAuditTokenInput.extend({ formData: SelfAuditResponseData });

/**
 * Forms anyone with the link can answer without an account (`/forms/*`, `src/lib/public-forms.ts`).
 * Answers are stored as Submitted `FormInstance`s in the form's organisation; its admins read
 * them back. Submits are checked with Vercel BotID: the paths are tagged on the client in
 * `src/instrumentation-client.ts` (`PUBLIC_FORM_BOT_PROTECTED_PATHS`).
 *
 * The self-audit's procedures (`…SelfAudit…ByToken`) are reached through a per-member emailed link
 * instead: the token finds the organisation and the request (`src/server/services/self-audit-public.ts`).
 * Unknown, replaced and expired tokens all read as `not-found`, and the writes refuse them with
 * NOT_FOUND "This link has expired or isn't valid."
 */
export const publicFormsRouter = createTrpcRouter({
    /**
     * The member's self-audit form for a link token: `{ state: "not-found" }`, or who it's for, what
     * they're asked and their answers so far. Reads only: opening the link changes nothing.
     */
    getSelfAuditByToken: publicProcedure
        .input(selfAuditTokenInput)
        .output(SelfAuditByTokenOutput)
        .query(async ({ ctx, input: { token } }) => {
            return await SelfAuditPublic.getSelfAuditByToken(ctx, token);
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
     * Record that the member opened their self-audit form (`openedAt`, if unset). Idempotent.
     * @throws TRPCError(NOT_FOUND) if the link has expired or isn't valid.
     */
    openSelfAuditByToken: publicProcedure
        .input(selfAuditTokenInput)
        .mutation(async ({ ctx, input: { token } }) => {
            await SelfAuditPublic.openSelfAuditByToken(ctx, token);
            return { opened: true as const };
        }),

    /**
     * Send a submitted self-audit back to Draft, so the member can change their answers. The last
     * submitted answers stand until they submit again.
     * @throws TRPCError(NOT_FOUND) if the link has expired or isn't valid.
     */
    reopenSelfAuditByToken: publicProcedure
        .input(selfAuditTokenInput)
        .mutation(async ({ ctx, input: { token } }) => {
            await SelfAuditPublic.reopenSelfAuditByToken(ctx, token);
            return { reopened: true as const };
        }),

    /**
     * Autosave the member's self-audit answers. Not checked with BotID: it fires often, and the
     * token already gates it.
     * @throws TRPCError(NOT_FOUND) if the link has expired or isn't valid.
     * @throws TRPCError(CONFLICT) if the form has been submitted.
     */
    saveSelfAuditDraftByToken: publicProcedure
        .input(selfAuditAnswerInput)
        .mutation(async ({ ctx, input: { token, formData } }) => {
            await SelfAuditPublic.saveSelfAuditDraftByToken(ctx, token, formData);
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
     * Submit the member's self-audit answers.
     * @throws TRPCError(FORBIDDEN) if BotID judges the request a bot's.
     * @throws TRPCError(NOT_FOUND) if the link has expired or isn't valid.
     * @throws TRPCError(BAD_REQUEST) if something the form asks is unanswered.
     * @throws TRPCError(CONFLICT) if the form has already been submitted.
     */
    submitSelfAuditByToken: publicProcedure
        .input(selfAuditAnswerInput)
        .mutation(async ({ ctx, input: { token, formData } }) => {
            await assertNotBot();
            await SelfAuditPublic.submitSelfAuditByToken(ctx, token, formData);
            return { submitted: true as const };
        }),
});
