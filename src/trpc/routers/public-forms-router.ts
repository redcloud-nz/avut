/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { checkBotId } from "botid/server";
import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { JacketInterestRow, JacketInterestSubmission } from "@/lib/schemas/jacket-interest";
import * as PublicForms from "@/server/services/public-forms";

import { createTrpcRouter, organizationProcedure, publicProcedure } from "../init";

/**
 * Forms anyone with the link can answer without an account (`/forms/*`, `src/lib/public-forms.ts`).
 * Answers are stored as Submitted `FormInstance`s in the form's organisation; its admins read
 * them back. Submits are checked with Vercel BotID: the paths are tagged on the client in
 * `src/instrumentation-client.ts` (`PUBLIC_FORM_BOT_PROTECTED_PATHS`).
 */
export const publicFormsRouter = createTrpcRouter({
    /**
     * Every answer to the soft shell jacket form in the organisation, oldest first. Org admins.
     */
    listJacketInterest: organizationProcedure({ organization: ["update"] })
        .output(z.array(JacketInterestRow))
        .query(async ({ ctx }) => {
            return await PublicForms.listJacketInterest(ctx);
        }),

    /**
     * Store one answer to the soft shell jacket form.
     * @throws TRPCError(FORBIDDEN) if BotID judges the request a bot's.
     * @throws TRPCError(PRECONDITION_FAILED) if the form's organisation doesn't exist.
     */
    submitJacketInterest: publicProcedure
        .input(JacketInterestSubmission)
        .mutation(async ({ ctx, input }) => {
            const verification = await checkBotId();
            if (verification.isBot) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Your answer couldn't be accepted. Please try again in a browser.",
                });
            }
            await PublicForms.submitJacketInterest(ctx, input);
            return { stored: true as const };
        }),
});
