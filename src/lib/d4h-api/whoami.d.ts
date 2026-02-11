/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export interface D4HWhoami {
    account: {
        id: number;
        resourceType: string;
    };
    members: {
        hasAccess: boolean;
        id: number;
        name: string;
        owner: {
            id: number;
            resourceType: string;
            title: string;
            owner?: {
                id: number;
                resourceType: string;
            };
        };
        permissions?: Record<
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
    }[];
}

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
