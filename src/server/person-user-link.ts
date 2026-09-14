/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Matching and linking a `Person` to a `User` within one organization — the shared half of
 * `docs/specs/person-user-linking.md` Parts 2 and 3.
 *
 * Deliberately NOT marked `server-only` and free of any `@/server/prisma` import: the Prisma
 * client is injected by the caller, so this is reachable both from a better-auth hook (which runs
 * outside any tRPC procedure) and from the jsdom test environment against `createMockPrisma()`.
 * Keeping the logic here rather than inline in `src/server/auth.ts` is what makes it testable at
 * all — that module pulls in `server-only` transitively and cannot be imported under jsdom.
 *
 * Nothing here grants membership. Both lookups only ever fill in `OrganizationUser.personId` on a
 * membership that already exists; an email match is never an authorisation decision.
 */

import type { Person, PrismaClient, User } from "@/generated/prisma/client";
import type { OrganizationId } from "@/lib/schemas/organization";
import type { UserId } from "@/lib/schemas/user";

import { formatActorLabel, recordLogEntry, type LogEntryPrisma } from "./log-entry";
import { readOrganizationSettings } from "./organization-settings-store";

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
 * `email` is a `User.email`, which better-auth stores lowercased. `Person.email` is admin-typed
 * and *not* normalised, so the comparison has to be case-insensitive on the column — which rules
 * out an index-backed exact match.
 *
 * The candidate set is narrowed in SQL (this org, Active, not yet linked) and the email compared
 * in JS rather than with `mode: "insensitive"`. Two reasons: there is no functional index on
 * `lower(personnel.email)`, so Postgres would scan that candidate set either way; and
 * `prisma-mock` ignores the `{ equals: … }` filter object entirely, so a query written that way
 * returns `null` in every test while working in production — a silent gap rather than a failure.
 *
 * `Person @@unique([organizationId, email])` means at most one row can match, so no tie-break is
 * needed beyond the case fold.
 */
export async function findLinkablePerson(
    prisma: PersonUserLinkPrisma,
    { organizationId, email }: { organizationId: string; email: string },
): Promise<Person | null> {
    const needle = email.toLowerCase();

    const candidates = await prisma.person.findMany({
        where: {
            organizationId,
            status: "Active",
            organizationUser: { is: null },
        },
    });

    return candidates.find((person) => person.email.toLowerCase() === needle) ?? null;
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
): Promise<{ user: User; organizationUserId: string } | null> {
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
        const settings = await readOrganizationSettings(prisma, organizationId);
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
