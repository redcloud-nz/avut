/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import type { SaratogaContentsItem } from "@/components/blocks/saratoga-contents";
import type { ModuleFlagState } from "@/lib/module-flags";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { D4HIntegration_SettingsCard } from "./d4h-integration-settings";
import { D4HViewsModule_SettingsCard } from "./d4h-views-module-settings";
import { EmailIntegration_SettingsCard } from "./email-integration-settings";
import { General_SettingsCard } from "./general-settings";
import { I3Module_SettingsCard } from "./i3-module-settings";
import { Personnel_SettingsCard } from "./personnel-settings";
import { RubbishBin_SettingsCard } from "./rubbish-bin-settings";
import { SkillPackageBuilderModule_SettingsCard } from "./skill-package-builder-module-settings";
import { SkillTrackModule_SettingsCard } from "./skill-track-module-settings";

/**
 * The full organization-settings form: a stack of independently saved cards. Each card owns its
 * own sub-form and save button, and writes through `useOrganizationSettingsMutation`.
 *
 * Shared verbatim by the in-org admin settings page and the system-admin settings page — same
 * cards, same section `id`s (matched by `getOrganizationSettingsFormSections` below for the
 * contents nav).
 */
export function OrganizationSettingsForm({
    organizationId,
    moduleFlags,
    settings,
}: {
    organizationId: OrganizationId;
    /** Environment-level module availability — a module's card is hidden when its flag is off. */
    moduleFlags: ModuleFlagState;
    settings: OrganizationSettings;
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

            <div id="rubbish-bin" className="space-y-4 pt-6 scroll-mt-4">
                <h3 className="text-lg font-semibold tracking-tight">Rubbish Bin</h3>
                <RubbishBin_SettingsCard organizationId={organizationId} settings={settings} />
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
        { id: "rubbish-bin", label: "Rubbish Bin" },
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
