/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type {
    OrganizationGroupMembershipStatus as OrganizationGroupMembershipStatusRecord,
    OrganizationGroupRole as OrganizationGroupRoleRecord,
} from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { OrganizationData } from "./organization";

export const OrganizationGroupId = {
    schema: zodNanoId16("OrganizationGroupId expected").brand<"OrganizationGroupId">(),

    create: () => OrganizationGroupId.schema.parse(nanoId16()),
} as const;

export type OrganizationGroupId = z.infer<typeof OrganizationGroupId.schema>;

export const OrganizationGroupMembershipId = {
    schema: zodNanoId16(
        "OrganizationGroupMembershipId expected",
    ).brand<"OrganizationGroupMembershipId">(),

    create: () => OrganizationGroupMembershipId.schema.parse(nanoId16()),
} as const;

export type OrganizationGroupMembershipId = z.infer<typeof OrganizationGroupMembershipId.schema>;

/** An organization's role in a group. At most one active `Overseer` per group (enforced in the service). */
export const OrganizationGroupRole = {
    schema: z.enum(["Overseer", "Member"]),

    displayNames: {
        Overseer: "Overseer",
        Member: "Member",
    } satisfies Record<OrganizationGroupRoleRecord, string>,
} as const;

export type OrganizationGroupRole = z.infer<typeof OrganizationGroupRole.schema>;

/** A membership's state. `Invited` is DORMANT: reserved for the later invite → accept flow. */
export const OrganizationGroupMembershipStatus = {
    schema: z.enum(["Invited", "Active", "Revoked"]),

    displayNames: {
        Invited: "Invited",
        Active: "Active",
        Revoked: "Revoked",
    } satisfies Record<OrganizationGroupMembershipStatusRecord, string>,
} as const;

export type OrganizationGroupMembershipStatus = z.infer<
    typeof OrganizationGroupMembershipStatus.schema
>;

const nameSchema = OrganizationData.createSchema.shape.name;
const slugSchema = OrganizationData.createSchema.shape.slug;

const createGroupSchema = z.object({
    name: nameSchema,
    slug: slugSchema,
});

export const OrganizationGroupData = {
    schema: z.object({
        id: OrganizationGroupId.schema,
        name: nameSchema,
        slug: slugSchema,
        logo: z.url().nullable(),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
    }),

    /** Input for creating a group — the same name and slug rules as an organization. */
    createSchema: createGroupSchema,

    /** Input for updating a group's name and slug. */
    updateSchema: createGroupSchema.extend({
        groupId: OrganizationGroupId.schema,
    }),
};

export type OrganizationGroupData = z.infer<typeof OrganizationGroupData.schema>;

/**
 * A reference to a group. The name uses the create bounds (2–100), unlike `OrganizationRef`'s
 * `min(5)`, so every group that can be created can be referenced.
 */
export const OrganizationGroupRef = {
    schema: z.object({
        id: OrganizationGroupId.schema,
        name: nameSchema,
    }),
};

export type OrganizationGroupRef = z.infer<typeof OrganizationGroupRef.schema>;
