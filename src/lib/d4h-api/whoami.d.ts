/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { D4HResource } from "./resource";

export interface D4HWhoami {
    account: D4HResource<"Account">;
    members: (D4HResource<"Member"> & {
        hasAccess: boolean;
        name: string;
        owner: D4HResource<"Team"> & {
            title: string;
            owner?: D4HResource<"Organization">;
        };
        permissions?: D4HPermissions;
    })[];
    officers: (D4HResource<"Officer"> & {
        hasAccess: boolean;
        name: string;
        owner: D4HResource<"Organization"> & { title: string };
        permissions?: D4HPermissions;
    })[];
}

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
