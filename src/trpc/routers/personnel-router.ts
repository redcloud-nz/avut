/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { nanoId16 } from "@/lib/id";
import { PersonData, PersonId } from "@/lib/schemas/person";

import { revalidatePerson } from "@/server/person";

import { createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";
import { FieldConflictError } from "../types";

/**
 * Router for personnel management within an organization.
 */
export const personnelRouter = createTrpcRouter({
    /**
     * Creates a new person in the organization.
     * @param ctx The authenticated context.
     * @param input The input object containing the person data.
     * @returns The created person object.
     * @throws TRPCError(CONFLICT) if a person with the same email already exists.
     */
    createPerson: organizationProcedure({ person: ["create"] })
        .input(
            PersonData.schema.omit({
                createdAt: true,
                updatedAt: true,
                status: true,
            }),
        )
        .output(PersonData.schema)
        .mutation(async ({ ctx, input: person }) => {
            // Check for conflicts
            const [emailConflict] = await Promise.all([
                ctx.prisma.person.findFirst({
                    where: {
                        organizationId: ctx.organizationId,
                        email: person.email,
                    },
                }),
            ]);

            if (emailConflict)
                throw new TRPCError({
                    code: "CONFLICT",
                    message:
                        "A person with this email address already exists in this organization.",
                    cause: new FieldConflictError("email"),
                });

            const created = await ctx.prisma.person.create({
                data: {
                    id: person.id,
                    organizationId: ctx.organizationId,
                    name: person.name,
                    email: person.email,
                    tags: person.tags,
                    properties: person.properties,
                    status: "Active",
                },
            });

            ctx.logEvent({
                action: "Create",
                objectType: "Person",
                objectId: created.id,
            });

            await ctx.prisma.organizationLogEntry.create({
                data: {
                    id: nanoId16(),
                    organizationId: ctx.organizationId,
                    userId: ctx.authSession.user.id,
                    action: "Create",
                    objectType: "Person",
                    objectId: created.id,
                },
            });

            return PersonData.fromRecord(created);
        }),

    /**
     * Delete a person from the organization.
     * @param ctx The authenticated context.
     * @param input The input object containing the personId.
     * @returns The deleted person object.
     * @throws TRPCError(NOT_FOUND) if the person is not found.
     * @throws TRPCError(FORBIDDEN) if the user does not have permission to delete the person.
     */
    deletePerson: organizationProcedure({ person: ["delete"] })
        .input(z.object({ personId: PersonId.schema }))
        .output(
            z.object({
                deletionType: z.enum(["Soft", "Hard"]),
                person: PersonData.schema,
            }),
        )
        .mutation(async ({ ctx, input: { personId } }) => {
            const person = await ctx.prisma.person.findUnique({
                where: { organizationId: ctx.organizationId, id: personId },
                include: {
                    skillChecksAsAssessee: true,
                    skillChecksAsAssessor: true,
                },
            });

            if (!person) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Person(${personId}) not found.`,
                });
            }

            await ctx.logEvent({
                action: "Delete",
                objectType: "Person",
                objectId: person.id,
            });

            if (
                person.skillChecksAsAssessee.length > 0 ||
                person.skillChecksAsAssessor.length > 0
            ) {
                // Soft delete the person if they are referenced in skill checks
                await ctx.prisma.person.update({
                    where: { organizationId: ctx.organizationId, id: personId },
                    data: { status: "Deleted" },
                });

                return {
                    deletionType: "Soft",
                    person: PersonData.fromRecord({
                        ...person,
                        status: "Deleted",
                    }),
                };
            } else {
                // Hard delete the person if they are not referenced anywhere
                await ctx.prisma.person.delete({
                    where: { organizationId: ctx.organizationId, id: personId },
                });

                return {
                    deletionType: "Hard",
                    person: PersonData.fromRecord({
                        ...person,
                        status: "Deleted",
                    }),
                };
            }
        }),

    /**
     * Retrieves a person by their ID.
     * @param ctx The authenticated context.
     * @param input The input object containing the personId.
     * @returns The person object.
     * @throws TRPCError(NOT_FOUND) if the person is not found.
     */
    getPerson: organizationProcedure()
        .input(z.object({ personId: PersonId.schema }))
        .output(PersonData.schema)
        .query(async ({ ctx, input: { personId } }) => {
            const person = await ctx.prisma.person.findUnique({
                where: { organizationId: ctx.organizationId, id: personId },
            });

            if (!person)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.personNotFound(personId),
                });

            return PersonData.fromRecord(person);
        }),

    /**
     * Updates an existing person.
     * @param ctx The authenticated context.
     * @param input The data to update the person with.
     * @returns The updated person object.
     * @throws TRPCError(CONFLICT) If a person with the new email already exists.
     * @throws TRPCError(NOT_FOUND) If the person to update is not found.
     */
    updatePerson: organizationProcedure({ person: ["update"] })
        .input(
            PersonData.schema.pick({
                id: true,
                name: true,
                email: true,
                tags: true,
                properties: true,
            }),
        )
        .output(PersonData.schema)
        .mutation(
            async ({
                ctx,
                input: { id: personId, organizationId, ...update },
            }) => {
                const existing = await ctx.prisma.person.findUnique({
                    where: { organizationId: ctx.organizationId, id: personId },
                });

                if (!existing)
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: Messages.personNotFound(personId),
                    });

                if (update.email != existing.email) {
                    // Check if a person with the new email already exists
                    const emailConflict = await ctx.prisma.person.findFirst({
                        where: {
                            email: update.email,
                            organizationId: ctx.organizationId,
                        },
                    });
                    if (emailConflict)
                        throw new TRPCError({
                            code: "CONFLICT",
                            message:
                                "A person with this email address already exists in this organisation.",
                            cause: new FieldConflictError("email"),
                        });
                }

                // Calculate changes from existing record
                const changes = diffObject(
                    PersonData.schema
                        .pick({
                            name: true,
                            email: true,
                            tags: true,
                            properties: true,
                        })
                        .parse(existing),
                    update,
                );

                if (changes.length == 0) return PersonData.fromRecord(existing); // No changes

                const updated = await ctx.prisma.person.update({
                    where: { organizationId: ctx.organizationId, id: personId },
                    data: { ...update },
                });

                await ctx.logEvent({
                    action: "Update",
                    objectType: "Person",
                    objectId: personId,
                    changes: changes,
                });

                // Clear cached data
                revalidatePerson(personId);

                return PersonData.fromRecord(updated);
            },
        ),
});
