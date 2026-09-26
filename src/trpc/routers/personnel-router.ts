/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { diffObject } from "@/lib/diff";
import { InvitationId } from "@/lib/schemas/organization-invitation";
import { OrganizationUser } from "@/lib/schemas/organization-user";
import { PersonData, PersonId } from "@/lib/schemas/person";
import { UserData } from "@/lib/schemas/user";
import * as Personnel from "@/server/services/personnel";

import { FieldConflictError } from "../errors";
import { createTrpcRouter, organizationProcedure } from "../init";

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
            return { updated: await Personnel.archive(ctx, personId) };
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
                throw new FieldConflictError(
                    "email",
                    "A person with this email address already exists in this organisation.",
                );

            // Delegates to the shared service so this path and the D4H team import behave
            // identically — in particular, both auto-link.
            return await Personnel.create(ctx, personId, create);
        }),

    /**
     * Soft-deletes a person from the organization (reversible via `restorePersonFromTrash`).
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
        .output(z.object({ person: PersonData.schema }))
        .mutation(async ({ ctx, input: { personId } }) => {
            return { person: await Personnel.deleteRecord(ctx, personId) };
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
            const person = await Personnel.requireRecordById(ctx, personId, {
                include: { organizationUser: { select: { id: true } } },
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
                // it is also invisible to the dashboard's own invitation lookup, which is a
                // pre-existing gap in that flow rather than something this query should paper over.
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
        .output(
            OrganizationUser.schema
                .extend({ user: UserData.schema.pick({ id: true, name: true, email: true }) })
                .nullable(),
        )
        .query(async ({ ctx, input: { personId } }) => {
            const person = await Personnel.requireRecordById(ctx, personId, {
                include: { organizationUser: { include: { user: true } } },
            });

            return person.organizationUser
                ? {
                      ...OrganizationUser.fromRecord(person.organizationUser),
                      user: UserData.fromRecord(person.organizationUser.user),
                  }
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
            const person = await Personnel.requireById(ctx, personId);

            return person;
        }),

    /**
     * Describes what deleting this person would hide from active views, for the delete
     * confirmation dialog's impact preview.
     * @throws TRPCError(NOT_FOUND) if the person is not found.
     */
    getPersonDeleteImpact: organizationProcedure({ person: ["view"] })
        .input(
            z.object({
                personId: PersonId.schema,
            }),
        )
        .output(z.object({ teamCount: z.number(), skillCheckCount: z.number() }))
        .query(async ({ ctx, input: { personId } }) => {
            return await Personnel.getDeleteImpact(ctx, personId);
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
     * Restores an archived person in the organization back to Active.
     * @param ctx The authenticated context.
     * @param input The input object containing the personId.
     * @returns The restored person object.
     * @throws TRPCError(NOT_FOUND) if the person is not found.
     * @throws TRPCError(BAD_REQUEST) if the person is not Archived.
     */
    restorePerson: organizationProcedure({ person: ["update"] })
        .input(
            z.object({
                personId: PersonId.schema,
            }),
        )
        .output(z.object({ updated: PersonData.schema }))
        .mutation(async ({ ctx, input: { personId } }) => {
            return { updated: await Personnel.restoreFromArchive(ctx, personId) };
        }),

    /**
     * Restores a deleted person in the organization back to Active.
     * @param ctx The authenticated context.
     * @param input The input object containing the personId.
     * @returns The restored person object.
     * @throws TRPCError(NOT_FOUND) if the person is not found.
     * @throws TRPCError(BAD_REQUEST) if the person is not Deleted.
     */
    restorePersonFromTrash: organizationProcedure({ person: ["delete"] })
        .input(
            z.object({
                personId: PersonId.schema,
            }),
        )
        .output(z.object({ updated: PersonData.schema }))
        .mutation(async ({ ctx, input: { personId } }) => {
            return { updated: await Personnel.restoreFromTrash(ctx, personId) };
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
            const existing = await Personnel.requireById(ctx, personId);

            if (update.email != existing.email) {
                // Check if a person with the new email already exists
                const emailConflict = await ctx.prisma.person.findFirst({
                    where: {
                        email: update.email,
                        organizationId: ctx.organizationId,
                    },
                });
                if (emailConflict)
                    throw new FieldConflictError(
                        "email",
                        "A person with this email address already exists in this organisation.",
                    );
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
