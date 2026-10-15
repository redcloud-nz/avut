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
import { EmailIntegration_SettingsCard } from "./email-integration-settings";
import { Feature_SettingsCard } from "./feature-settings-card";
import { Personnel_SettingsCard } from "./personnel-settings";
import { RubbishBin_SettingsCard } from "./rubbish-bin-settings";
import { SkillTrackModule_SettingsCard } from "./skill-track-module-settings";

/**
 * The full organization-settings view: a stack of cards that show the current values. Editors
 * change them in place — inline switches for on/off settings, Enable/Disable on module and
 * integration cards (`Feature_SettingsCard`), and `?action=` dialogs for anything with a typed
 * value — each saving a patch of just its own field(s) through `useOrganizationSettingsMutation`.
 * Without `canEdit` none of those controls render, and the values show read-only.
 *
 * Shared verbatim by the in-org admin settings page and the system-admin settings page — same
 * cards, same section `id`s (matched by `getOrganizationSettingsFormSections` below for the
 * contents nav).
 */
export function OrganizationSettingsForm({
    organizationId,
    moduleFlags,
    settings,
    canEdit,
}: {
    organizationId: OrganizationId;
    /** Environment-level module availability — a module's card is hidden when its flag is off. */
    moduleFlags: ModuleFlagState;
    settings: OrganizationSettings;
    /**
     * Whether to render the editing controls. A plain boolean rather than `<Protect>`, because the
     * system-admin page has no current organization for `<Protect>` to read roles from.
     */
    canEdit: boolean;
}) {
    return (
        <>
            <div id="personnel" className="space-y-4 scroll-mt-4">
                <h3 className="text-lg font-semibold tracking-tight">Personnel</h3>
                <Personnel_SettingsCard
                    organizationId={organizationId}
                    settings={settings}
                    canEdit={canEdit}
                />
            </div>

            <div id="rubbish-bin" className="space-y-4 pt-6 scroll-mt-4">
                <h3 className="text-lg font-semibold tracking-tight">Rubbish Bin</h3>
                <RubbishBin_SettingsCard
                    organizationId={organizationId}
                    settings={settings}
                    canEdit={canEdit}
                />
            </div>

            <div id="integrations" className="space-y-4 pt-6 scroll-mt-4">
                <h3 className="text-lg font-semibold tracking-tight">Integrations</h3>
                <D4HIntegration_SettingsCard
                    organizationId={organizationId}
                    settings={settings}
                    canEdit={canEdit}
                />
                <EmailIntegration_SettingsCard
                    organizationId={organizationId}
                    settings={settings}
                    canEdit={canEdit}
                />
            </div>

            <div id="modules" className="space-y-4 pt-6 scroll-mt-4">
                <h3 className="text-lg font-semibold tracking-tight">Modules</h3>
                <div id="module-d4h-views" className="scroll-mt-4">
                    <Feature_SettingsCard
                        organizationId={organizationId}
                        canEdit={canEdit}
                        slice="modules.d4h-views"
                        enabled={settings.modules["d4h-views"].enabled}
                        kind="module"
                        title="D4H Views Module"
                    />
                </div>
                {moduleFlags.i3 !== false && (
                    <div id="module-i3" className="scroll-mt-4">
                        <Feature_SettingsCard
                            organizationId={organizationId}
                            canEdit={canEdit}
                            slice="modules.i3"
                            enabled={settings.modules.i3.enabled}
                            kind="module"
                            title="I3 Module"
                            description="The I3 module provides tools to manage individually issued items (I3s) within your organisation."
                        />
                    </div>
                )}
                {moduleFlags.notes !== false && (
                    <div id="module-notes" className="scroll-mt-4">
                        <Feature_SettingsCard
                            organizationId={organizationId}
                            canEdit={canEdit}
                            slice="modules.notes"
                            enabled={settings.modules.notes.enabled}
                            kind="module"
                            title="Notes Module"
                            description="The Notes module gives your organisation a shared place for markdown notes."
                        />
                    </div>
                )}
                <div id="module-skill-package-builder" className="scroll-mt-4">
                    <Feature_SettingsCard
                        organizationId={organizationId}
                        canEdit={canEdit}
                        slice="modules.skill-package-builder"
                        enabled={settings.modules["skill-package-builder"].enabled}
                        kind="module"
                        title="Skill Package Builder Module"
                        description="The Skill Package Builder module allows you to create and manage skill packages that can then be used by the Skills Module."
                    />
                </div>
                <div id="module-skill-track" className="scroll-mt-4">
                    <SkillTrackModule_SettingsCard
                        organizationId={organizationId}
                        settings={settings}
                        canEdit={canEdit}
                    />
                </div>
            </div>
        </>
    );
}

/**
 * Matches the section (and, for "Modules", per-module card) `id`s above — passed to
 * `Saratoga.Contents` by the page. Takes `moduleFlags` so the "Modules" children stay in sync
 * with which cards the form itself actually renders (`i3` and `notes`, gated the same way above).
 */
export function getOrganizationSettingsFormSections(
    moduleFlags: ModuleFlagState,
): SaratogaContentsItem[] {
    return [
        { id: "personnel", label: "Personnel" },
        { id: "rubbish-bin", label: "Rubbish Bin" },
        { id: "integrations", label: "Integrations" },
        {
            id: "modules",
            label: "Modules",
            children: [
                { id: "module-d4h-views", label: "D4H Views" },
                ...(moduleFlags.i3 !== false ? [{ id: "module-i3", label: "I3" }] : []),
                ...(moduleFlags.notes !== false ? [{ id: "module-notes", label: "Notes" }] : []),
                { id: "module-skill-package-builder", label: "Skill Package Builder" },
                { id: "module-skill-track", label: "Skill Track" },
            ],
        },
    ];
}
