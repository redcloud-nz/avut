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

/** The slice of the Prisma client this module needs. */
export type PersonUserLinkPrisma = Pick<PrismaClient, "person" | "organizationUser" | "user">;

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
