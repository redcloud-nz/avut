/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { D4HIntegration_SettingsCard } from "@/components/admin-settings/d4h-integration-card";
import { D4HViewsModule_SettingsCard } from "@/components/admin-settings/d4h-views-module-card";
import { EmailIntegration_SettingsCard } from "@/components/admin-settings/email-integration-card";
import { General_SettingsCard } from "@/components/admin-settings/general-settings-card";
import { I3Module_SettingsCard } from "@/components/admin-settings/i3-module-card";
import { Personnel_SettingsCard } from "@/components/admin-settings/personnel-card";
import { SkillPackageBuilderModule_SettingsCard } from "@/components/admin-settings/skill-package-builder-module-card";
import { SkillTrackModule_SettingsCard } from "@/components/admin-settings/skill-track-module-card";
import type { SaratogaContentsItem } from "@/components/blocks/saratoga-contents";
import type { ModuleFlagState } from "@/lib/module-flags";
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
    moduleFlags,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    /** Environment-level module availability — a module's card is hidden when its flag is off. */
    moduleFlags: ModuleFlagState;
}) {
    return (
        <>
            <div id="general" className="space-y-4 scroll-mt-4">
                <General_SettingsCard />
            </div>

            <div id="personnel" className="space-y-4 pt-6 scroll-mt-4">
                <h3 className="text-lg font-semibold tracking-tight">Personnel</h3>
                <Personnel_SettingsCard organizationId={organizationId} settings={settings} />
            </div>

            <div id="integrations" className="space-y-4 pt-6 scroll-mt-4">
                <h3 className="text-lg font-semibold tracking-tight">Integrations</h3>
                <D4HIntegration_SettingsCard organizationId={organizationId} settings={settings} />
                <EmailIntegration_SettingsCard
                    organizationId={organizationId}
                    settings={settings}
                />
            </div>

            <div id="modules" className="space-y-4 pt-6 scroll-mt-4">
                <h3 className="text-lg font-semibold tracking-tight">Modules</h3>
                <div id="module-d4h-views" className="scroll-mt-4">
                    <D4HViewsModule_SettingsCard
                        organizationId={organizationId}
                        settings={settings}
                    />
                </div>
                {moduleFlags.i3 !== false && (
                    <div id="module-i3" className="scroll-mt-4">
                        <I3Module_SettingsCard
                            organizationId={organizationId}
                            settings={settings}
                        />
                    </div>
                )}
                <div id="module-skill-package-builder" className="scroll-mt-4">
                    <SkillPackageBuilderModule_SettingsCard
                        organizationId={organizationId}
                        settings={settings}
                    />
                </div>
                <div id="module-skill-track" className="scroll-mt-4">
                    <SkillTrackModule_SettingsCard
                        organizationId={organizationId}
                        settings={settings}
                    />
                </div>
            </div>
        </>
    );
}

/**
 * Matches the section (and, for "Modules", per-module card) `id`s above — passed to
 * `Saratoga.Contents` by the page. Takes `moduleFlags` so the "Modules" children stay in sync
 * with which cards the form itself actually renders (e.g. `i3`, gated the same way above).
 */
export function getOrganizationSettingsFormSections(
    moduleFlags: ModuleFlagState,
): SaratogaContentsItem[] {
    return [
        { id: "general", label: "General" },
        { id: "personnel", label: "Personnel" },
        { id: "integrations", label: "Integrations" },
        {
            id: "modules",
            label: "Modules",
            children: [
                { id: "module-d4h-views", label: "D4H Views" },
                ...(moduleFlags.i3 !== false ? [{ id: "module-i3", label: "I3" }] : []),
                { id: "module-skill-package-builder", label: "Skill Package Builder" },
                { id: "module-skill-track", label: "Skill Track" },
            ],
        },
    ];
}
