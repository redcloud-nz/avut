/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { OrganizationUser } from "@/lib/schemas/organization-user";

import { InvitationId } from "@/lib/schemas/organization-invitation";
import { PersonData, PersonId } from "@/lib/schemas/person";
import { UserData } from "@/lib/schemas/user";

import { findLinkableMember } from "@/server/person-user-link";
import { readOrganizationSettings } from "@/server/organization-settings-store";

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

            const [updated] = await ctx.prisma.$transaction([
                ctx.prisma.person.update({
                    where: { organizationId: ctx.organizationId, id: personId },
                    data: { status: "Archived" },
                }),
                ctx.logEvent({
                    action: "Archive",
                    objectType: "Person",
                    objectId: personId,
                }),
            ]);

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
            const emailConflict = await ctx.prisma.person.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    email: create.email,
                },
            });

            if (emailConflict)
                throw new TRPCError({
                    code: "CONFLICT",
                    cause: new FieldConflictError(
                        "email",
                        "A person with this email address already exists in this organization.",
                    ),
                });

            // Delegates to the shared helper so this path and the D4H team import behave
            // identically — in particular, both auto-link.
            return await createPerson(ctx, personId, create);
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

            const isReferenced =
                person.skillChecksAsAssessee.length > 0 || person.skillChecksAsAssessor.length > 0;

            if (isReferenced) {
                // Soft delete the person if they are referenced in skill checks
                await ctx.prisma.$transaction([
                    ctx.prisma.person.update({
                        where: { organizationId: ctx.organizationId, id: personId },
                        data: { status: "Deleted" },
                    }),
                    ctx.logEvent({
                        action: "Delete",
                        objectType: "Person",
                        objectId: person.id,
                    }),
                ]);
            } else {
                // Hard delete the person if they are not referenced anywhere
                await ctx.prisma.$transaction([
                    ctx.prisma.person.delete({
                        where: { organizationId: ctx.organizationId, id: personId },
                    }),
                    ctx.logEvent({
                        action: "Delete",
                        objectType: "Person",
                        objectId: person.id,
                    }),
                ]);
            }

            return {
                deletionType: isReferenced ? "Soft" : "Hard",
                person: PersonData.fromRecord({
                    ...person,
                    status: "Deleted",
                }),
            };
        }),

    /**
     * Describes what inviting this person to AVUT would mean right now, so the invite dialog can
     * offer the right action.
     *
     * The `AlreadyMember` case is not cosmetic: better-auth's `createInvitation` rejects an invite
     * outright when a member already holds that email
     * (`USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION`), so the dialog has to link instead of
     * invite.
     *
     * Emails are matched by lowercasing the needle and comparing exactly, NOT with
     * `mode: "insensitive"`. `User.email` is lowercase by construction — better-auth lowercases it
     * on sign-up (`api/routes/sign-up.mjs`) and in the OAuth link path
     * (`oauth2/link-account.mjs`), which also compares `userInfo.email.toLowerCase()` against the
     * stored value. `Person.email` is admin-typed and not normalised, so only the needle needs it.
     * An exact match also uses the unique index on `users.email`, which a case-insensitive
     * comparison could not.
     *
     * @param ctx The authenticated context.
     * @param input The input object containing the personId.
     * @returns The invite state, the matching user account if one exists, and any pending invitation.
     * @throws TRPCError(NOT_FOUND) if the person is not found.
     */
    getInviteState: organizationProcedure({
        invitation: ["view"],
        member: ["view"],
        person: ["view"],
    })
        .input(
            z.object({
                personId: PersonId.schema,
            }),
        )
        .output(
            z.object({
                /**
                 * `Linked` — already attached to a user here, nothing to do.
                 * `AlreadyMember` — a user with this email is already in the org and is not linked
                 *   to anyone; link, don't invite.
                 * `MemberLinkedElsewhere` — that member's account is already linked to a *different*
                 *   person here. Neither action is available: an invitation would be refused
                 *   (`USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION`) and linking would silently
                 *   steal the other person's account. Someone has to unlink it first.
                 * `UserExists` — the person has an AVUT account but is not a member here; invite.
                 * `NoUser` — no account anywhere; invite.
                 */
                state: z.enum([
                    "Linked",
                    "AlreadyMember",
                    "MemberLinkedElsewhere",
                    "UserExists",
                    "NoUser",
                ]),
                user: UserData.schema.nullable(),
                pendingInvitation: z
                    .object({ id: InvitationId.schema, createdAt: z.iso.datetime() })
                    .nullable(),
            }),
        )
        .query(async ({ ctx, input: { personId } }) => {
            const person = await ctx.prisma.person.findUnique({
                where: { organizationId: ctx.organizationId, id: personId },
                include: { organizationUser: { select: { id: true } } },
            });

            if (!person)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.personNotFound(personId),
                });

            const email = person.email.toLowerCase();

            const [user, pendingInvitation] = await Promise.all([
                ctx.prisma.user.findFirst({
                    where: { email },
                    include: {
                        organizationUsers: {
                            where: { organizationId: ctx.organizationId },
                            // `personId` distinguishes `AlreadyMember` from
                            // `MemberLinkedElsewhere`. Selecting it is why this does not filter on
                            // `personId: null` the way `findLinkableMember` does — that filter
                            // would make a member already linked to someone else look like a
                            // non-member, and the dialog would offer an invitation better-auth
                            // refuses.
                            select: { id: true, personId: true },
                        },
                    },
                }),
                // Matches what the invite dialog writes, which lowercases for the same reason.
                // An invitation typed mixed-case on the Invitations page will not be found here —
                // it is also invisible to `getEntryControl`, which is a pre-existing gap in that
                // flow rather than something this query should paper over.
                ctx.prisma.organizationInvitation.findFirst({
                    where: { organizationId: ctx.organizationId, email, status: "pending" },
                    orderBy: { createdAt: "desc" },
                }),
            ]);

            const membership = user?.organizationUsers[0] ?? null;

            const state = person.organizationUser
                ? "Linked"
                : !user
                  ? "NoUser"
                  : !membership
                    ? "UserExists"
                    : membership.personId
                      ? "MemberLinkedElsewhere"
                      : "AlreadyMember";

            return {
                state,
                user: user ? UserData.fromRecord(user) : null,
                pendingInvitation: pendingInvitation
                    ? {
                          id: InvitationId.schema.parse(pendingInvitation.id),
                          createdAt: pendingInvitation.createdAt.toISOString(),
                      }
                    : null,
            };
        }),

    /**
     * Gets the linked user for a person.
     * @param ctx The authenticated context.
     * @param input The input object containing the personId.
     * @returns The linked user object or null if not found.
     * @throws TRPCError(NOT_FOUND) if the person is not found.
     */
    getLinkedUser: organizationProcedure({ member: ["view"], person: ["view"] })
        .input(
            z.object({
                personId: PersonId.schema,
            }),
        )
        .output(OrganizationUser.schema.nullable())
        .query(async ({ ctx, input: { personId } }) => {
            const person = await ctx.prisma.person.findUnique({
                where: { organizationId: ctx.organizationId, id: personId },
                include: { organizationUser: { include: { user: true } } },
            });

            if (!person)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.personNotFound(personId),
                });

            return person.organizationUser
                ? OrganizationUser.fromRecord(person.organizationUser.user, person.organizationUser)
                : null;
        }),

    /**
     * Gets a person by ID.
     * @param ctx The authenticated context.
     * @param personId The ID of the person to retrieve.
     * @returns The person object.
     * @throws TRPCError(NOT_FOUND) if the person is not found.
     */
    getPerson: organizationProcedure({ person: ["view"] })
        .input(
            z.object({
                personId: PersonId.schema,
            }),
        )
        .output(PersonData.schema)
        .query(async ({ ctx, input: { personId } }) => {
            const person = await getPersonOrThrow(ctx, personId);

            return person;
        }),

    /**
     * Returns the person record linked to the current user within the organization, or null if no link exists.
     */
    getPersonSelf: organizationProcedure()
        .output(PersonData.schema.nullable())
        .query(async ({ ctx }) => {
            const orgUser = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId: ctx.organizationId, userId: ctx.userId },
                include: { person: true },
            });
            return orgUser?.person ? PersonData.fromRecord(orgUser.person) : null;
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
     * Lists the active personnel in the organization that are not yet linked to a user account.
     * Used to populate the "link person" picker on the user detail page.
     * @param ctx The authenticated organization context.
     * @returns An array of unlinked personnel records.
     */
    listUnlinkedPersonnel: organizationProcedure({ person: ["view"] })
        .output(z.array(PersonData.schema))
        .query(async ({ ctx }) => {
            const personnel = await ctx.prisma.person.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    status: "Active",
                    organizationUser: { is: null },
                },
                orderBy: { name: "asc" },
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

            const [updated] = await ctx.prisma.$transaction([
                ctx.prisma.person.update({
                    where: { organizationId: ctx.organizationId, id: personId },
                    data: { status: "Active" },
                }),
                ctx.logEvent({
                    action: "Restore",
                    objectType: "Person",
                    objectId: personId,
                }),
            ]);

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
        .output(
            z.object({
                updated: PersonData.schema,
            }),
        )
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

            const [updated] = await ctx.prisma.$transaction([
                ctx.prisma.person.update({
                    where: { organizationId: ctx.organizationId, id: personId },
                    data: { ...update },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "Person",
                    objectId: personId,
                    changes,
                }),
            ]);

            return {
                updated: PersonData.fromRecord(updated),
            };
        }),
});

export async function createPerson(
    ctx: AuthenticatedOrganizationContext,
    personId: PersonId,
    create: z.infer<typeof PersonData.modifiableSchema>,
    /** Set when this create is part of a multi-entry operation, so the entries join its batch. */
    batchId?: string,
): Promise<{ created: PersonData }> {
    // Calculate changes from empty record
    const changes = diffObject({ tags: [], properties: {} }, create);

    /*
     * Auto-link (spec Part 3): if the organization opted in and an existing *member* holds this
     * email, attach them as the person is created.
     *
     * Only a member. A user with an AVUT account who does not belong to this organization is left
     * alone — linking them would mean granting membership on the strength of an email address.
     * They get invited from the person's own page instead.
     *
     * Read uncached, and read outside the transaction: the write below re-checks `personId: null`
     * anyway, so a link landing in between loses the race rather than corrupting anything.
     */
    const settings = await readOrganizationSettings(ctx.prisma, ctx.organizationId);
    const linkable = settings.personnel.autoLinkOnPersonCreate
        ? await findLinkableMember(ctx.prisma, {
              organizationId: ctx.organizationId,
              email: create.email,
          })
        : null;

    /*
     * Interactive rather than `$transaction([...])` because the link is conditional on its own
     * write succeeding — an array would commit the audit entry even when `updateMany` matched
     * nothing. `ctx.logEvent` takes the transaction client, so both entries still go through the
     * one sanctioned path.
     */
    const created = await ctx.prisma.$transaction(async (tx) => {
        const person = await tx.person.create({
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

        await ctx.logEvent(
            {
                action: "Create",
                objectType: "Person",
                objectId: personId,
                changes,
                batchId,
            },
            tx,
        );

        if (linkable) {
            const { count } = await tx.organizationUser.updateMany({
                where: { id: linkable.organizationUserId, personId: null },
                data: { personId },
            });

            if (count === 1) {
                await ctx.logEvent(
                    {
                        action: "Update",
                        objectType: "OrganizationMembership",
                        objectId: linkable.organizationUserId,
                        description: `Linked person (${personId}, ${create.name}) to user (${linkable.user.id}) on creation — matched on email address.`,
                        refs: [
                            { objectType: "Person", objectId: personId, role: "context" },
                        ],
                        batchId,
                    },
                    tx,
                );
            }
        }

        return person;
    });

    return {
        created: PersonData.fromRecord(created),
    };
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
        where: {
            organizationId: ctx.organizationId,
            email: { equals: email, mode: "insensitive" },
        },
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
        where: {
            organizationId: ctx.organizationId,
            id: personId,
        },
    });

    if (!person) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: Messages.personNotFound(personId),
        });
    }

    return PersonData.fromRecord(person);
}
