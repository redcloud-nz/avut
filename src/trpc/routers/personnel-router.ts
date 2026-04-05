/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { PersonData, PersonId } from "@/lib/schemas/person";

import { revalidatePerson } from "@/server/person";

import { FieldConflictError } from "../errors";
import { AuthenticatedOrganizationContext, createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

/**
 * Router for personnel management within an organization.
 */
export const personnelRouter = createTrpcRouter({
    /**
     * Archives a person in the organization.
     * @param ctx The authenticated context.
     * @param input The input object containing the personId.
     * @returns The archived person object.
     * @throws TRPCError(NOT_FOUND) if the person is not found.
     */
    archivePerson: organizationProcedure({ person: ["update"] })
        .input(
            z.object({
                personId: PersonId.schema,
            }),
        )
        .output(z.object({ updated: PersonData.schema }))
        .mutation(async ({ ctx, input: { personId } }) => {
            const existing = await ctx.prisma.person.findUnique({
                where: { organizationId: ctx.organizationId, id: personId },
            });

            if (!existing)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.personNotFound(personId),
                });

            if (existing.status === "Archived") {
                return { updated: PersonData.fromRecord(existing) }; // Already archived
            }

            const updated = await ctx.prisma.person.update({
                where: { organizationId: ctx.organizationId, id: personId },
                data: { status: "Archived" },
            });

            await ctx.logEvent({
                action: "Archive",
                objectType: "Person",
                objectId: personId,
            });

            // Clear cached data
            revalidatePerson(personId);

            return { updated: PersonData.fromRecord(updated) };
        }),

    /**
     * Creates a new person in the organization.
     * @param ctx The authenticated context.
     * @param input The input object containing the person data.
     * @returns The created person object.
     * @throws TRPCError(CONFLICT) if a person with the same email already exists.
     */
    createPerson: organizationProcedure({ person: ["create"] })
        .input(
            z.object({
                personId: PersonId.schema,
                create: PersonData.modifiableSchema,
            }),
        )
        .output(z.object({ created: PersonData.schema }))
        .mutation(async ({ ctx, input: { personId, create } }) => {
            // Check for conflicts
            const [emailConflict] = await Promise.all([
                ctx.prisma.person.findFirst({
                    where: {
                        organizationId: ctx.organizationId,
                        email: create.email,
                    },
                }),
            ]);

            if (emailConflict)
                throw new TRPCError({
                    code: "CONFLICT",
                    cause: new FieldConflictError(
                        "email",
                        "A person with this email address already exists in this organization.",
                    ),
                });

            const created = await ctx.prisma.person.create({
                data: {
                    id: personId,
                    organizationId: ctx.organizationId,
                    name: create.name,
                    email: create.email,
                    tags: create.tags,
                    properties: create.properties,
                    status: "Active",
                },
            });

            // Calculate changes from empty record
            const changes = diffObject({}, create);

            await ctx.logEvent({
                action: "Create",
                objectType: "Person",
                objectId: created.id,
                changes: changes,
            });

            return { created: PersonData.fromRecord(created) };
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
        .input(
            z.object({
                personId: PersonId.schema,
            }),
        )
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
     * Lists all personnel in the organization.
     * @param ctx The authenticated context.
     * @returns An array of person objects.
     */
    listPersonnel: organizationProcedure({ person: ["view"] })
        .output(z.array(PersonData.schema))
        .query(async ({ ctx }) => {
            const personnel = await ctx.prisma.person.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    status: { not: "Deleted" },
                },
            });
            return personnel.map(PersonData.fromRecord);
        }),

    /**
     * Restores an archived or deleted person in the organization.
     * @param ctx The authenticated context.
     * @param input The input object containing the personId.
     * @returns The restored person object.
     * @throws TRPCError(NOT_FOUND) if the person is not found.
     */
    restorePerson: organizationProcedure({ person: ["update"] })
        .input(
            z.object({
                personId: PersonId.schema,
            }),
        )
        .output(z.object({ updated: PersonData.schema }))
        .mutation(async ({ ctx, input: { personId } }) => {
            const existing = await ctx.prisma.person.findUnique({
                where: { organizationId: ctx.organizationId, id: personId },
            });

            if (!existing)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.personNotFound(personId),
                });

            if (existing.status == "Active") {
                return { updated: PersonData.fromRecord(existing) }; // Not restorable
            }

            const updated = await ctx.prisma.person.update({
                where: { organizationId: ctx.organizationId, id: personId },
                data: { status: "Active" },
            });

            await ctx.logEvent({
                action: "Restore",
                objectType: "Person",
                objectId: personId,
            });

            // Clear cached data
            revalidatePerson(personId);

            return { updated: PersonData.fromRecord(updated) };
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
            z.object({
                personId: PersonId.schema,
                update: PersonData.modifiableSchema,
            }),
        )
        .output(z.object({ updated: PersonData.schema }))
        .mutation(async ({ ctx, input: { personId, update } }) => {
            const existing = await getPersonOrThrow(ctx, personId);

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
                        cause: new FieldConflictError(
                            "email",
                            "A person with this email address already exists in this organisation.",
                        ),
                    });
            }

            // Calculate changes from existing record
            const changes = diffObject(PersonData.modifiableSchema.parse(existing), update);

            if (changes.length == 0) return { updated: existing }; // No changes

            const updated = await ctx.prisma.person.update({
                where: { organizationId: ctx.organizationId, id: personId },
                data: { ...update },
            });

            await ctx.logEvent({
                action: "Update",
                objectType: "Person",
                objectId: personId,
                changes,
            });

            // Clear cached data
            revalidatePerson(personId);

            return { updated: PersonData.fromRecord(updated) };
        }),
});

export async function createPerson(
    ctx: AuthenticatedOrganizationContext,
    personId: PersonId,
    create: z.infer<typeof PersonData.modifiableSchema>,
) {
    const created = await ctx.prisma.person.create({
        data: {
            id: personId,
            organizationId: ctx.organizationId,
            name: create.name,
            email: create.email,
            tags: create.tags,
            properties: create.properties,
            status: "Active",
        },
    });

    // Calculate changes from empty record
    const changes = diffObject({}, create);

    await ctx.logEvent({
        action: "Create",
        objectType: "Person",
        objectId: created.id,
        changes: changes,
    });

    return { created: PersonData.fromRecord(created) };
}

/**
 * Utility function to fetch a person by email.
 * @param ctx The authenticated context containing the organization ID and Prisma client.
 * @param email The email address of the person to fetch.
 * @returns The person data if found, or null if not found.
 */
export async function getPersonByEmail(
    ctx: AuthenticatedOrganizationContext,
    email: string,
): Promise<PersonData | null> {
    const person = await ctx.prisma.person.findFirst({
        where: { organizationId: ctx.organizationId, email },
    });

    return person ? PersonData.fromRecord(person) : null;
}

/**
 * Utility function to fetch a person by ID and throw a TRPCError if not found.
 * @param ctx The authenticated context containing the organization ID and Prisma client.
 * @param personId The ID of the person to fetch.
 * @returns The person data if found.
 * @throws TRPCError(NOT_FOUND) if the person is not found in the organization.
 */
async function getPersonOrThrow(
    ctx: AuthenticatedOrganizationContext,
    personId: PersonId,
): Promise<PersonData> {
    const person = await ctx.prisma.person.findUnique({
        where: { organizationId: ctx.organizationId, id: personId },
    });

    if (!person) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: Messages.personNotFound(personId),
        });
    }

    return PersonData.fromRecord(person);
}
