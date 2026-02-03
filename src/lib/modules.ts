/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { OrganizationSettings } from "./schemas/organization-settings";
import { OrganizationWithSettings } from "./schemas/organization";

export type ModuleID =
    | "d4h-views"
    | "notes"
    | "skills"
    | "skill-package-manager";

export interface Module {
    id: ModuleID;
    name: string;
    isEnabledKey: keyof OrganizationSettings;
}

export const Modules: Module[] = [
    {
        id: "d4h-views",
        name: "D4H Views",
        isEnabledKey: "modules.d4h-views.enabled",
    },
    { id: "notes", name: "Notes", isEnabledKey: "modules.notes.enabled" },
    { id: "skills", name: "Skills", isEnabledKey: "modules.skills.enabled" },
    {
        id: "skill-package-manager",
        name: "Skill Package Manager",
        isEnabledKey: "modules.skill-package-manager.enabled",
    },
];

export function isModuleEnabled(
    organization: OrganizationWithSettings,
    moduleId: ModuleID,
): boolean {
    const module = Modules.find((mod) => mod.id === moduleId);
    if (!module) {
        throw new Error(`Module with ID "${moduleId}" not found.`);
    }
    return organization.settings[module.isEnabledKey] === true;
}
