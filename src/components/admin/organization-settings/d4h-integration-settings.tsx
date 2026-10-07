/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { D4HServerList } from "@/lib/d4h-servers";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { Feature_SettingsCard } from "./feature-settings-card";
import { SettingRow } from "./setting-row";
import { OrganizationSettings_UpdateD4HDefaultServer_Dialog } from "./update-d4h-default-server";

const DEFAULT_SERVER_DESCRIPTION = "The D4H region to use by default when connecting to D4H.";

/** The D4H integration: Enable/Disable, and while it's enabled, its default server. */
export function D4HIntegration_SettingsCard({
    organizationId,
    settings,
    canEdit,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    canEdit: boolean;
}) {
    const { enabled, defaultServer } = settings.integrations.d4h;
    const serverName =
        D4HServerList.find((server) => server.code === defaultServer)?.name ?? defaultServer;

    return (
        <Feature_SettingsCard
            organizationId={organizationId}
            canEdit={canEdit}
            slice="integrations.d4h"
            enabled={enabled}
            kind="integration"
            title="D4H Integration"
        >
            <SettingRow
                title="Default Server"
                description={DEFAULT_SERVER_DESCRIPTION}
                value={serverName}
                action={
                    canEdit && (
                        <OrganizationSettings_UpdateD4HDefaultServer_Dialog
                            organizationId={organizationId}
                            settings={settings}
                            description={DEFAULT_SERVER_DESCRIPTION}
                        />
                    )
                }
            />
        </Feature_SettingsCard>
    );
}
