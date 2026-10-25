/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import type { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import type { PersonId } from "@/lib/schemas/person";
import type { TeamId } from "@/lib/schemas/team";
import { fetchD4HMember } from "@/server/d4h-api/client";
import { sendEmail } from "@/server/email";

import * as OrgSettings from "./organization-settings";
import type { OrgServiceContext } from "./service-context";

/** The message `sendEmail` takes (the `resend` package itself is off limits outside `email.ts`). */
type EmailPayload = Parameters<typeof sendEmail>[0];

export interface NotifyRecipient {
    personId: PersonId;
    name: string;
    email: string;
}

/**
 * The people to notify of an I3 Issue or Return for a D4H team: the org-wide list in
 * `modules.d4h-i3.notify.org`, plus the lists of every AVUT team in this org (not Deleted)
 * linked to `d4hTeamId`.
 *
 * Only Active people in this org with a non-empty email are kept, so ids that no longer resolve
 * are dropped silently. Deduped by `PersonId`. An empty result means nobody is notified.
 *
 * Reads settings uncached, so a just-saved list applies to the next submission.
 */
export async function resolveNotifyRecipients(
    ctx: OrgServiceContext,
    { d4hTeamId }: { d4hTeamId: number },
): Promise<NotifyRecipient[]> {
    const settings = await OrgSettings.read(ctx.prisma, ctx.organizationId);
    const { notify } = settings.modules["d4h-i3"];

    const teams = await ctx.prisma.team.findMany({
        where: {
            organizationId: ctx.organizationId,
            status: { not: "Deleted" },
            d4h: { is: { d4hTeamId } },
        },
        select: { id: true },
    });

    const personIds = new Set<string>(notify.org);
    for (const team of teams) {
        for (const personId of notify.teams[team.id as TeamId] ?? []) {
            personIds.add(personId);
        }
    }
    if (personIds.size === 0) return [];

    const people = await ctx.prisma.person.findMany({
        where: {
            organizationId: ctx.organizationId,
            status: "Active",
            id: { in: [...personIds] },
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
    });

    return people
        .filter((person) => person.email.trim() !== "")
        .map((person) => ({
            personId: person.id as PersonId,
            name: person.name,
            email: person.email.trim(),
        }));
}

/**
 * The address to send a member's I3 receipt to: their current D4H email, trimmed. `null` when
 * D4H has no such member or the member has no email. Fetch errors propagate to the caller.
 */
export async function fetchReceiptAddress(
    accessToken: D4HAccessToken_ServerOnly,
    { d4hTeamId, memberId }: { d4hTeamId: number; memberId: number },
): Promise<string | null> {
    const member = await fetchD4HMember(accessToken, d4hTeamId, memberId);
    const email = member?.email?.value.trim() ?? "";
    return email === "" ? null : email;
}

/**
 * Send one email per recipient, in sequence, so each gets their own copy (and their own
 * "sent to" footer) and no recipient sees the others' addresses. `sendEmail` logs its own
 * failures and never rejects.
 */
export async function sendEach<R>(
    recipients: readonly R[],
    build: (recipient: R) => EmailPayload,
): Promise<void> {
    for (const recipient of recipients) {
        await sendEmail(build(recipient));
    }
}
