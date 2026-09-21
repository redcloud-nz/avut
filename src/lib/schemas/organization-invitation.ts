/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { OrganizationInvitation as InvitationRecord } from "@/generated/prisma/client";
import { nanoId16 } from "@/lib/id";
import { zodNanoId16 } from "@/lib/validation";

import { OrganizationId } from "./organization";
import { OrganizationRole } from "./organization-role";
import { PersonId } from "./person";
import { UserId } from "./user";

export const InvitationId = {
    schema: zodNanoId16("InvitationId expected").brand<"InvitationId">(),

    create: () => InvitationId.schema.parse(nanoId16()),
} as const;

export type InvitationId = z.infer<typeof InvitationId.schema>;

export const OrganizationInvitationData = {
    schema: z.object({
        id: InvitationId.schema,
        organizationId: OrganizationId.schema,
        personId: PersonId.schema.nullable(),
        email: z.email(),
        roles: z.array(OrganizationRole.schema),
        status: z.string(),
        inviterId: UserId.schema,
        createdAt: z.iso.datetime(),
        expiresAt: z.iso.datetime(),
        teamId: z.string().nullable(),
    }),

    fromRecord: (record: InvitationRecord) =>
        OrganizationInvitationData.schema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            expiresAt: record.expiresAt.toISOString(),
            roles: record.role?.split(",") ?? [],
            teamId: record.teamId ?? null,
        }),
};

export type OrganizationInvitationData = z.infer<typeof OrganizationInvitationData.schema>;

/**
 * What the public invitation landing page (`/invitations/[invitation_id]`) is told about an
 * invitation — enough to render the right screen for whoever is looking, and nothing an
 * unauthenticated holder of the link shouldn't see.
 *
 * `state` folds the stored `status` and `expiresAt` into one value: a `pending` row past its
 * expiry is `expired`, and any unrecognised non-accepted status is `canceled`.
 */
export const InvitationLandingData = {
    schema: z.union([
        z.object({ state: z.literal("not-found") }),
        z.object({
            state: z.enum(["pending", "expired", "accepted", "rejected", "canceled"]),
            organization: z.object({ name: z.string(), slug: z.string() }),
            inviterName: z.string(),
            email: z.string(),
            /** The linked personnel record's name, for prefilling sign-up. */
            personName: z.string().nullable(),
            /** Whether an AVUT account already exists for `email` — sign in rather than sign up. */
            hasAccount: z.boolean(),
            viewer: z.discriminatedUnion("kind", [
                z.object({ kind: z.literal("anonymous") }),
                /** Signed in as the address the invitation was sent to. */
                z.object({ kind: z.literal("recipient") }),
                /** Signed in as somebody else. */
                z.object({ kind: z.literal("other"), email: z.string() }),
            ]),
        }),
    ]),
};

export type InvitationLandingData = z.infer<typeof InvitationLandingData.schema>;
