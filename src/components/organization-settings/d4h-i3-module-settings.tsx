/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useQuery } from "@tanstack/react-query";

import type { OrganizationModuleId } from "@/lib/modules";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { trpc } from "@/trpc/client";

import { Feature_SettingsCard } from "./feature-settings-card";
import { SettingEnabledBadge, SettingRow } from "./setting-row";
import { OrganizationSettings_SettingSwitch } from "./setting-switch";
import { OrganizationSettings_UpdateI3Notify_Dialog, summariseI3Notify } from "./update-i3-notify";

const ORGANISATION_ONLY_DESCRIPTION =
    "When creating or editing templates, offer only the D4H categories, types, brands and models owned by your D4H organisation, so every new template can be issued in every team.";

const NOTIFY_DESCRIPTION =
    "Who is emailed when items are issued or returned: everyone on the organisation-wide list, plus the list for the recipient's team. The member also gets a receipt at their D4H email.";

/**
 * The D4H I3 module: Enable/Disable, and while it's enabled, the one setting that limits the
 * template pickers to records owned by the org's linked D4H organisation.
 *
 * The switch needs a D4H organisation to match against, so it's held off (with a note) when the
 * org has no `Organization_D4H` row or is in org-less-team mode. A switch already on stays
 * usable, so it can be turned off.
 *
 * The Notifications row summarises who is emailed on Issue and Return. Its edit dialog reads the
 * org's personnel and teams, which the system-admin page can't reach, so there (`systemAdmin`)
 * the row shows the summary only, as it does for a viewer without `canEdit`.
 */
export function D4HI3Module_SettingsCard({
    organizationId,
    settings,
    canEdit,
    isModuleEnabled,
    systemAdmin = false,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    canEdit: boolean;
    isModuleEnabled?: (moduleId: OrganizationModuleId) => boolean;
    /** Rendered on the system-admin page, where the org-scoped personnel and team lists aren't reachable. */
    systemAdmin?: boolean;
}) {
    const { enabled, organisationRecordsOnly, notify } = settings.modules["d4h-i3"];

    const { data: orgD4H, isSuccess } = useQuery(
        trpc.teams.getOrganizationD4H.queryOptions({ organizationId }),
    );
    // While pending or after a failed fetch, the switch stays held off and the note stays out.
    const linked = orgD4H?.d4hOrganisationId != null;
    const needsLink = isSuccess && !linked;

    return (
        <Feature_SettingsCard
            organizationId={organizationId}
            canEdit={canEdit}
            slice="modules.d4h-i3"
            enabled={enabled}
            isModuleEnabled={isModuleEnabled}
            kind="module"
            title="D4H I3 Module"
            description="The D4H I3 module provides tools to manage individually issued items (I3s) within your organisation."
        >
            <SettingRow
                title="Organisation-owned records only"
                description={
                    <>
                        {ORGANISATION_ONLY_DESCRIPTION}
                        {needsLink && (
                            <span className="mt-1 block">
                                Needs this organisation linked to a D4H organisation.
                            </span>
                        )}
                    </>
                }
                value={
                    canEdit ? (
                        <OrganizationSettings_SettingSwitch
                            organizationId={organizationId}
                            slice="modules.d4h-i3"
                            field="organisationRecordsOnly"
                            value={organisationRecordsOnly}
                            label="Organisation-owned records only"
                            disabled={!linked && !organisationRecordsOnly}
                        />
                    ) : (
                        <SettingEnabledBadge enabled={organisationRecordsOnly} />
                    )
                }
            />
            <SettingRow
                title="Notifications"
                description={NOTIFY_DESCRIPTION}
                value={summariseI3Notify(notify)}
                action={
                    canEdit &&
                    !systemAdmin && (
                        <OrganizationSettings_UpdateI3Notify_Dialog
                            organizationId={organizationId}
                            settings={settings}
                            description={NOTIFY_DESCRIPTION}
                        />
                    )
                }
            />
        </Feature_SettingsCard>
    );
}
