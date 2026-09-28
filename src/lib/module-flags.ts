/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { OrganizationModuleId } from "@/lib/modules";

/**
 * Environment-level availability of every org-scoped module, keyed by id.
 *
 * A module is available in a deployment only when its Vercel flag is on for that
 * environment (production / preview / development). Modules without a flag are always
 * `true`. This is layered *in front of* the per-org `settings.modules.<id>.enabled`
 * opt-in — both must be true for a module to be usable.
 */
export type ModuleFlagState = Record<OrganizationModuleId, boolean>;

/** Org modules whose availability is gated by a Vercel flag. */
export const FLAGGED_MODULE_IDS = [
    "i3",
    "notes",
] as const satisfies readonly OrganizationModuleId[];

/**
 * Whether an org-scoped module is usable: its Vercel flag isn't off for this deployment, and
 * the organization has it on (or it's `alwaysOn`). The one rule `OrganizationClient.isModuleEnabled`
 * and the system-admin screens, which sit outside any one organization, both apply.
 */
export function isModuleUsable(
    moduleFlags: ModuleFlagState,
    moduleId: OrganizationModuleId,
    enabledForOrganization: boolean,
): boolean {
    return moduleFlags[moduleId] !== false && enabledForOrganization;
}
