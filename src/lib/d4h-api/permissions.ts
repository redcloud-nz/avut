/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

const D4HPermissions = {
    schema: z.object({
        APPROVE: z.boolean().optional(),
        ARCHIVED: z.boolean().optional(),
        ASSIGN_UNASSIGED: z.boolean().optional(),
        CREATE: z.boolean().optional(),
        CREATE_CUSTOM_FIELDS: z.boolean().optional(),
        CREATE_SECURE: z.boolean().optional(),
        DEFAULT_ACCESS: z.boolean().optional(),
        DELETE: z.boolean().optional(),
        DELETE_CUSTOM_FIELD: z.boolean().optional(),
        DELETE_SECURE: z.boolean().optional(),
        DOWNLOAD_SECURE: z.boolean().optional(),
        DRAFT: z.boolean().optional(),
        EXPORT: z.boolean().optional(),
        LIST: z.boolean().optional(),
        READ: z.boolean().optional(),
        READ_SECURE: z.boolean().optional(),
        UPDATE: z.boolean().optional(),
        UPDATE_CUSTOM_FIELDS: z.boolean().optional(),
        UPDATEOWN: z.boolean().optional(),
        UPDATE_SECURE: z.boolean().optional(),
        UPDATE_STATUS: z.boolean().optional(),
        UPDATE_RESULT: z.boolean().optional(),
    }),
} as const;

export const D4HTeamPermissions = {
    schema: z.object({
        Animal: D4HPermissions.schema,
        AnimalGroup: D4HPermissions.schema,
        AnimalQualification: D4HPermissions.schema,
        AnimalQualificationAward: D4HPermissions.schema,
        Audit: D4HPermissions.schema,
        BillingUnit: D4HPermissions.schema,
        CustomField: D4HPermissions.schema,
        CustomFieldOption: D4HPermissions.schema,
        CustomIdentifier: D4HPermissions.schema,
        Division: D4HPermissions.schema,
        Document: D4HPermissions.schema,
        Duty: D4HPermissions.schema,
        Equipment: D4HPermissions.schema,
        EquipmentInspection: D4HPermissions.schema,
        EquipmentInspectionResult: D4HPermissions.schema,
        EquipmentLocation: D4HPermissions.schema,
        EquipmentUsage: D4HPermissions.schema,
        Event: D4HPermissions.schema,
        Exercise: D4HPermissions.schema,
        HandlerGroup: D4HPermissions.schema,
        HandlerQualification: D4HPermissions.schema,
        HandlerQualificationAward: D4HPermissions.schema,
        HealthAndSafetyCategory: D4HPermissions.schema,
        HealthAndSafetyReport: D4HPermissions.schema,
        HealthAndSafetySeverity: D4HPermissions.schema,
        Incident: D4HPermissions.schema,
        LocationBookmark: D4HPermissions.schema,
        Member: D4HPermissions.schema,
        MemberGroup: D4HPermissions.schema,
        MemberQualification: D4HPermissions.schema,
        MemberQualificationAward: D4HPermissions.schema,
        PersonInvolved: D4HPermissions.schema,
        Repair: D4HPermissions.schema,
        Resource: D4HPermissions.schema,
        ResourceBundle: D4HPermissions.schema,
        Role: D4HPermissions.schema,
        Setting: D4HPermissions.schema,
        Tag: D4HPermissions.schema,
        Task: D4HPermissions.schema,
        Team: D4HPermissions.schema,
        Whiteboard: D4HPermissions.schema,
    }),
} as const;

export type D4HTeamPermissions = z.infer<typeof D4HTeamPermissions.schema>;
