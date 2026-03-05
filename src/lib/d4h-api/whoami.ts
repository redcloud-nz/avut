/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { D4HResource } from "./resource";

export const D4HWhoami = {
    schema: z.object({
        account: z.object({
            id: z.number(),
            resourceType: z.literal("Account"),
        }),
        members: z.array(
            z.object({
                id: z.number(),
                resourceType: z.literal("Member"),
                hasAccess: z.boolean(),
                name: z.string(),
                owner: z.object({
                    id: z.number(),
                    resourceType: z.literal("Team"),
                    title: z.string(),
                    owner: z.object({
                        id: z.number(),
                        resourceType: z.literal("Organisation"),
                    }), //.optional(),
                }),
                permissions: z.record(
                    z.string(),
                    z.record(z.string(), z.boolean().optional()).optional(),
                ),
            }),
        ),
    }),
} as const;

export type D4HWhoami = z.infer<typeof D4HWhoami.schema>;

type D4HPermissions = Record<
    | "Animal"
    | "AnimalGroup"
    | "AnimalQualification"
    | "AnimalQualificationAward"
    | "Audit"
    | "BillingUnit"
    | "CustomField"
    | "CustomFieldOption"
    | "CustomIdentifier"
    | "Division"
    | "Document"
    | "Duty"
    | "Equipment"
    | "EquipmentInspection"
    | "EquipmentInspectionResult"
    | "EquipmentLocation"
    | "EquipmentUsage"
    | "Event"
    | "Exercise"
    | "HandlerGroup"
    | "HandlerQualification"
    | "HandlerQualificationAward"
    | "HealthAndSafetyCategory"
    | "HealthAndSafetyReport"
    | "HealthAndSafetySeverity"
    | "Incident"
    | "LocationBookmark"
    | "Member"
    | "MemberGroup"
    | "MemberQualification"
    | "MemberQualificationAward"
    | "PersonInvolved"
    | "Repair"
    | "Resource"
    | "ResourceBundle"
    | "Role"
    | "Setting"
    | "Tag"
    | "Task"
    | "Team"
    | "Whiteboard",
    Record<D4HPermissionType, boolean | undefined>
>;

type D4HPermissionType =
    | "APPROVE"
    | "ARCHIVED"
    | "ASSIGN_UNASSIGED"
    | "CREATE"
    | "CREATE_CUSTOM_FIELDS"
    | "CREATE_SECURE"
    | "DEFAULT_ACCESS"
    | "DELETE"
    | "DELETE_CUSTOM_FIELD"
    | "DELETE_SECURE"
    | "DOWNLOAD_SECURE"
    | "DRAFT"
    | "EXPORT"
    | "LIST"
    | "READ"
    | "READ_SECURE"
    | "UPDATE"
    | "UPDATE_CUSTOM_FIELDS"
    | "UPDATEOWN"
    | "UPDATE_SECURE"
    | "UPDATE_STATUS"
    | "UPDATE_RESULT";
