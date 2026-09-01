/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { D4hIntegration_SettingsCard } from "@/components/admin-settings/d4h-integration-card";
import { D4HViewsModule_SettingsCard } from "@/components/admin-settings/d4h-views-module-card";
import { EmailIntegration_SettingsCard } from "@/components/admin-settings/email-integration-card";
import { General_SettingsCard } from "@/components/admin-settings/general-settings-card";
import { I3Module_SettingsCard } from "@/components/admin-settings/i3-module-card";
import { SkillPackageBuilderModule_SettingsCard } from "@/components/admin-settings/skill-package-builder-module-card";
import { SkillTrackModule_SettingsCard } from "@/components/admin-settings/skill-track-module-card";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

/**
 * The full organization-settings form: a stack of independently-saved cards.
 *
 * Shared verbatim by the in-org admin settings page and the system-admin settings page. Each card
 * owns its own sub-form and save button and writes through
 * `useOrganizationSettingsMutation`, which routes to whichever tRPC surface the surrounding
 * `<OrganizationSettingsScopeProvider>` declared — so this component needs nothing beyond the
 * organization's id and its current settings.
 */
export function OrganizationSettingsForm({
    organizationId,
    settings,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
}) {
    return (
        <>
            <div className="space-y-4">
                <General_SettingsCard />
            </div>

            <div className="space-y-4 pt-6">
                <h3 className="text-lg font-semibold tracking-tight">Integrations</h3>
                <D4hIntegration_SettingsCard organizationId={organizationId} settings={settings} />
                <EmailIntegration_SettingsCard
                    organizationId={organizationId}
                    settings={settings}
                />
            </div>

            <div className="space-y-4 pt-6">
                <h3 className="text-lg font-semibold tracking-tight">Modules</h3>
                <D4HViewsModule_SettingsCard organizationId={organizationId} settings={settings} />
                <I3Module_SettingsCard organizationId={organizationId} settings={settings} />
                <SkillPackageBuilderModule_SettingsCard
                    organizationId={organizationId}
                    settings={settings}
                />
                <SkillTrackModule_SettingsCard
                    organizationId={organizationId}
                    settings={settings}
                />
            </div>
        </>
    );
}
