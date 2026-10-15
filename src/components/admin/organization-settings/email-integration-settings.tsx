/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { Feature_SettingsCard } from "./feature-settings-card";

/** The email integration: Enable/Disable only, since it has no settings of its own. */
export function EmailIntegration_SettingsCard({
    organizationId,
    settings,
    canEdit,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    canEdit: boolean;
}) {
    return (
        <Feature_SettingsCard
            organizationId={organizationId}
            canEdit={canEdit}
            slice="integrations.email"
            enabled={settings.integrations.email.enabled}
            kind="integration"
            title="Email Integration"
        />
    );
}
