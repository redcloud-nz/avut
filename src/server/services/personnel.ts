/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import * as z from "zod";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { diffObject } from "@/lib/diff";
import { NotFoundError } from "@/lib/errors";
import type { OrganizationId } from "@/lib/schemas/organization";
import { PersonData, type PersonId } from "@/lib/schemas/person";
import type { PersonRecord } from "@/lib/schemas/person";
import type { UserId, UserRecord } from "@/lib/schemas/user";
import { formatActorLabel, recordLogEntry, type LogEntryPrisma } from "@/server/log-entry";

import * as OrgSettings from "./organization-settings";
import type { OrgServiceContext } from "./service-context";

/**
 * Creates a new person in the organization.
 *
 * Delegates the auto-link check to `findLinkableMember` below, so this one path serves both the
 * `createPerson` mutation and the D4H team import identically — in particular, both auto-link.
 * The caller is responsible for any pre-write conflict check (e.g. duplicate email); this
 * function does not check for one.
 *
 * Pass a `ctx` bound with `withBatch` (`service-context.ts`) when this create is part of a
 * multi-entry operation, so its log entries join that operation's batch.
 */
export async function create(
    ctx: OrgServiceContext,
    personId: PersonId,
    data: z.infer<typeof PersonData.modifiableSchema>,
): Promise<{ created: PersonData }> {
    /*
     * `personnel.email` is stored lowercased (docs/specs/person-email-normalisation.md).
     * `PersonData.modifiableSchema` normalises every parsed path, but the D4H import builds its
     * person object in code and hands it straight to this function (`services/d4h-team-sync.ts`), so
     * the one write site that the schema cannot reach normalises here. Done before `changes`, so
     * the audit entry records the value actually stored.
     */
    data = { ...data, email: data.email.toLowerCase() };

    // Calculate changes from empty record
    const changes = diffObject({ tags: [], properties: {} }, data);

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
    const settings = await OrgSettings.read(ctx.prisma, ctx.organizationId);
    const linkable = settings.personnel.autoLinkOnPersonCreate
        ? await findLinkableMember(ctx.prisma, {
              organizationId: ctx.organizationId,
              email: data.email,
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
                name: data.name,
                email: data.email,
                tags: data.tags,
                properties: data.properties,
                status: "Active",
            },
        });

        await ctx.logEvent(
            {
                action: "Create",
                objectType: "Person",
                objectId: personId,
                changes,
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
                        description: `Linked person (${personId}, ${data.name}) to user (${linkable.user.id}) on creation — matched on email address.`,
                        refs: [{ objectType: "Person", objectId: personId, role: "context" }],
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
 * Fetch a person by email.
 *
 * Lowercase the needle and match exactly. The stored column is normalised
 * (docs/specs/person-email-normalisation.md), so this is index-backed via
 * `@@unique([organizationId, email])` — and, unlike the `mode: "insensitive"` form it replaces,
 * it behaves identically in `prisma-mock`, which ignores the whole `{ equals: … }` filter object
 * on a string field. That is what makes this function testable at all.
 *
 * Callers may still pass a mixed-case needle: the D4H sync plan carries the raw address it got
 * from D4H.
 */
export async function getByEmail(
    ctx: OrgServiceContext,
    email: string,
): Promise<PersonData | null> {
    const person = await ctx.prisma.person.findFirst({
        where: {
            organizationId: ctx.organizationId,
            email: email.toLowerCase(),
        },
    });

    return person ? PersonData.fromRecord(person) : null;
}

/**
 * Fetch a person by ID.
 * @throws NotFoundError if the person is not found in the organization.
 */
export async function requireById(ctx: OrgServiceContext, personId: PersonId): Promise<PersonData> {
    const person = await ctx.prisma.person.findUnique({
        where: {
            organizationId: ctx.organizationId,
            id: personId,
        },
    });

    if (!person) {
        throw new NotFoundError(`Person(id=${personId}) not found.`);
    }

    return PersonData.fromRecord(person);
}

/**
 * Fetch a person by ID with the given `include`, for a caller that needs relations `PersonData`
 * does not carry (e.g. `deletePerson`'s skill-check references, `getLinkedUser`'s membership).
 * Takes the same `{ include }` shape as `prisma.person.findUnique`, so it reads as a Prisma call
 * at the call site rather than an opaque options object.
 * @throws NotFoundError if the person is not found in the organization.
 */
export async function requireRecordById<Include extends Prisma.PersonInclude>(
    ctx: OrgServiceContext,
    personId: PersonId,
    { include }: { include: Include },
): Promise<Prisma.PersonGetPayload<{ include: Include }>> {
    const person = await ctx.prisma.person.findUnique({
        where: { organizationId: ctx.organizationId, id: personId },
        include,
    });

    if (!person) {
        throw new NotFoundError(`Person(id=${personId}) not found.`);
    }

    return person;
}

/*
 * Matching and linking a `Person` to a `User` within one organization — the shared half of
 * `docs/specs/person-user-linking.md` Parts 2 and 3.
 *
 * The four functions below take a narrow `prisma` param rather than `OrgServiceContext`,
 * deliberately: `linkPersonOnInvitationAccept` runs from a better-auth hook
 * (`src/server/auth.ts`), which is not a tRPC context and has no `OrgServiceContext` to offer.
 * Keeping the logic here rather than inline in `auth.ts` is also what makes it testable at all —
 * that module pulls in `@/server/prisma` (via the Prisma adapter) and cannot be imported under
 * jsdom.
 *
 * Nothing here grants membership. Both lookups only ever fill in `OrganizationUser.personId` on a
 * membership that already exists; an email match is never an authorisation decision.
 */

/** The slice of the Prisma client the lookups need. */
export type PersonUserLinkPrisma = Pick<PrismaClient, "person" | "organizationUser" | "user">;

/** Additionally what writing a link and its audit entry needs. */
export type PersonUserLinkWritePrisma = PersonUserLinkPrisma &
    LogEntryPrisma &
    Pick<PrismaClient, "organizationConfig" | "$transaction">;

/** The person who caused the link, denormalised onto the audit entry. */
export interface LinkActor {
    id: UserId;
    name: string;
    email: string;
}

/**
 * A person is **linkable** to a user when all of:
 *
 * 1. they are in the same organization;
 * 2. `Person.status` is `Active`;
 * 3. their email addresses match, case-insensitively;
 * 4. the person is not already linked to a user;
 * 5. the user is not already linked to a different person in that organization.
 *
 * 4 and 5 are the two `@unique` constraints, so violating either is a P2002 rather than a silent
 * overwrite. Every caller checks them and no-ops instead: an automatic link never steals an
 * existing one, and never surfaces an error to someone who did not ask for a link.
 */

/**
 * Find the person in `organizationId` who should be linked to a user with `email`.
 *
 * Both sides are now lowercase in the database — `User.email` because better-auth normalises it,
 * `Person.email` because we do (docs/specs/person-email-normalisation.md). So this is the same
 * rule as `findLinkableMember` below: lowercase the needle, match the column exactly. The needle
 * is still folded rather than trusted, since callers pass addresses that came from a form or from
 * D4H.
 *
 * That exact match is index-backed via `@@unique([organizationId, email])`, and — unlike the
 * `mode: "insensitive"` form — it behaves identically under `prisma-mock`, which ignores the
 * whole `{ equals: … }` filter object on a string field. This used to load every Active unlinked
 * person in the organization and fold case in JS to get around exactly that.
 *
 * `@@unique([organizationId, email])` means at most one row can match.
 */
export async function findLinkablePerson(
    prisma: PersonUserLinkPrisma,
    { organizationId, email }: { organizationId: string; email: string },
): Promise<PersonRecord | null> {
    return await prisma.person.findFirst({
        where: {
            organizationId,
            status: "Active",
            organizationUser: { is: null },
            email: email.toLowerCase(),
        },
    });
}

/**
 * Find the user who should be linked to a person with `email` — the opposite direction, used when
 * a person record is created.
 *
 * Only an existing **member** of `organizationId` is returned. A user who has an AVUT account but
 * does not belong to this organization is deliberately not a match: linking them would mean
 * granting membership on the strength of an email address.
 *
 * Here the needle is a `Person.email` and the column is `User.email`, which better-auth normalises
 * to lowercase on sign-up (`api/routes/sign-up.mjs`) and in the OAuth link path
 * (`oauth2/link-account.mjs`). So lowercasing the needle and matching exactly is both correct and
 * index-backed, unlike the direction above.
 */
export async function findLinkableMember(
    prisma: PersonUserLinkPrisma,
    { organizationId, email }: { organizationId: string; email: string },
): Promise<{ user: UserRecord; organizationUserId: string } | null> {
    const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase() },
        include: {
            organizationUsers: {
                where: { organizationId, personId: null },
                select: { id: true },
            },
        },
    });

    const membership = user?.organizationUsers[0];
    if (!user || !membership) return null;

    const { organizationUsers: _memberships, ...rest } = user;
    return { user: rest, organizationUserId: membership.id };
}

/**
 * Attach `personId` to the membership, but only while both sides are still unlinked.
 *
 * The guard lives in the `where` clause rather than in a preceding read, so a manual link landing
 * in between loses the race harmlessly instead of raising P2002 from inside an unattended hook.
 *
 * @returns the `OrganizationUser.id` that was linked, or `null` if nothing was written.
 */
export async function tryLinkPersonToMember(
    prisma: PersonUserLinkPrisma,
    {
        organizationId,
        userId,
        personId,
    }: { organizationId: string; userId: string; personId: string },
): Promise<string | null> {
    // Re-read rather than trust the caller: the person may have been linked since it looked.
    const person = await prisma.person.findFirst({
        where: { id: personId, organizationId },
        include: { organizationUser: { select: { id: true } } },
    });
    if (!person || person.organizationUser) return null;

    const membership = await prisma.organizationUser.findFirst({
        where: { organizationId, userId, personId: null },
        select: { id: true },
    });
    if (!membership) return null;

    const { count } = await prisma.organizationUser.updateMany({
        where: { id: membership.id, personId: null },
        data: { personId },
    });

    return count === 1 ? membership.id : null;
}

/**
 * Attach a person to the membership created by accepting an invitation, and record it.
 *
 * Two ways here, and only the second is a setting:
 *
 * 1. **The invitation names a person** (`invitationPersonId`) — sent from that person's own
 *    record, so an admin already decided. Always applied, regardless of settings.
 * 2. **Nothing named** — fall back to an email match, but only when the organization has
 *    `personnel.autoLinkOnInviteAccept` on.
 *
 * The link and its audit entry share one transaction, so the entry can never claim a link that
 * did not happen — which matters more here than in a tRPC procedure, because `tryLinkPersonToMember`
 * is allowed to write nothing when it loses a race.
 *
 * Settings are read uncached: an admin who turns the switch on and immediately has someone accept
 * should get the new behaviour, and this runs once per accepted invitation.
 *
 * @returns what was linked, or null if nothing was.
 */
export async function linkPersonOnInvitationAccept(
    prisma: PersonUserLinkWritePrisma,
    {
        organizationId,
        actor,
        invitationPersonId,
    }: {
        organizationId: OrganizationId;
        /** The user accepting the invitation — also the actor on the audit entry. */
        actor: LinkActor;
        /** `OrganizationInvitation.personId`, when the invitation named one. */
        invitationPersonId: string | null;
    },
): Promise<{ personId: string; organizationUserId: string } | null> {
    let personId = invitationPersonId;
    let reason = "the invitation named the person";

    if (!personId) {
        const settings = await OrgSettings.read(prisma, organizationId);
        if (!settings.personnel.autoLinkOnInviteAccept) return null;

        const person = await findLinkablePerson(prisma, { organizationId, email: actor.email });
        if (!person) return null;

        personId = person.id;
        reason = "matched on email address";
    }

    const resolvedPersonId = personId;

    return prisma.$transaction(async (tx) => {
        const organizationUserId = await tryLinkPersonToMember(tx, {
            organizationId,
            userId: actor.id,
            personId: resolvedPersonId,
        });

        // Already linked, or the person was taken since we looked — leave it alone and say so.
        if (!organizationUserId) return null;

        const person = await tx.person.findFirst({ where: { id: resolvedPersonId } });

        await recordLogEntry(
            {
                scope: "organization",
                organizationId,
                actor: { userId: actor.id },
                actorLabel: formatActorLabel(actor.name, actor.email),
                action: "Update",
                objectType: "OrganizationMembership",
                objectId: organizationUserId,
                description: `Linked person (${resolvedPersonId}${person ? `, ${person.name}` : ""}) to user (${actor.id}) on invitation accept — ${reason}.`,
                refs: [{ objectType: "Person", objectId: resolvedPersonId, role: "context" }],
            },
            tx,
        );

        return { personId: resolvedPersonId, organizationUserId };
    });
}
