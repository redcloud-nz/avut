/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { PersonId } from "@/lib/schemas/person";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheck, SkillCheckId } from "@/lib/schemas/skill-check";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

export const skillChecksRouter = createTrpcRouter({
    /**
     * Creates a skill check. If sessionId is provided, the session must exist and belong to the same organization.
     */
    createSkillCheck: organizationProcedure({ skillCheck: ["create"] })
        .input(
            z.object({
                skillCheckId: SkillCheckId.schema,
                sessionId: SkillCheckSessionId.schema.nullable(),
                create: SkillCheck.schema.pick({
                    assesseeId: true,
                    assessorId: true,
                    skillId: true,
                    result: true,
                    notes: true,
                }),
            }),
        )
        .output(SkillCheck.schema)
        .mutation(async ({ ctx, input }) => {
            const { skillCheckId, sessionId, create } = input;

            // Validate session exists if sessionId is provided
            if (sessionId) {
                const session = await ctx.prisma.skillCheckSession.findUnique({
                    where: {
                        id: sessionId,
                        organizationId: ctx.organizationId,
                    },
                });
                if (!session) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: Messages.skillCheckSessionNotFound(sessionId),
                    });
                }
            }

            const record = await ctx.prisma.skillCheck.create({
                data: {
                    id: skillCheckId,
                    organizationId: ctx.organizationId,
                    sessionId,
                    ...create,
                },
            });

            return SkillCheck.fromRecord(record);
        }),

    /**
     * Deletes a skill check. The skill check must belong to the organization.
     */
    deleteSkillCheck: organizationProcedure({ skillCheck: ["delete"] })
        .input(z.object({ skillCheckId: SkillCheckId.schema }))
        .mutation(async ({ ctx, input }) => {
            const { skillCheckId } = input;

            await ctx.prisma.skillCheck.delete({
                where: {
                    id: skillCheckId,
                    organizationId: ctx.organizationId,
                },
            });
        }),

    /**
     * Lists skill checks. Optionally filtered by sessionId, skillId, assesseeId, or assessorId.
     */
    listSkillChecks: organizationProcedure({ skillCheck: ["view"] })
        .input(
            z.object({
                sessionId: SkillCheckSessionId.schema.optional(),
                skillId: SkillId.schema.optional(),
                assesseeId: PersonId.schema.optional(),
                assessorId: PersonId.schema.optional(),
            }),
        )
        .output(z.array(SkillCheck.schema))
        .query(async ({ ctx, input }) => {
            const { sessionId, skillId, assesseeId, assessorId } = input;

            const checks = await ctx.prisma.skillCheck.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    sessionId,
                    skillId,
                    assesseeId,
                    assessorId,
                },
            });

            return checks.map((check) => SkillCheck.fromRecord(check));
        }),

    /**
     * Updates a skill check's result and notes. The skill check must belong to the organization.
     */
    updateSkillCheck: organizationProcedure({ skillCheck: ["update"] })
        .input(
            z.object({
                skillCheckId: SkillCheckId.schema,
                update: SkillCheck.schema.pick({
                    result: true,
                    notes: true,
                }),
            }),
        )
        .output(SkillCheck.schema)
        .mutation(async ({ ctx, input }) => {
            const { skillCheckId, update } = input;

            const record = await ctx.prisma.skillCheck.update({
                where: {
                    id: skillCheckId,
                    organizationId: ctx.organizationId,
                },
                data: update,
            });

            return SkillCheck.fromRecord(record);
        }),
});
