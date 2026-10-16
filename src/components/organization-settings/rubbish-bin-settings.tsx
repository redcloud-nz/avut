/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    OrganizationSettings,
    RUBBISH_BIN_MAX_RETENTION_DAYS,
} from "@/lib/schemas/organization-settings";

import { SettingRow } from "./setting-row";
import { OrganizationSettings_UpdateRubbishBin_Dialog } from "./update-rubbish-bin";

const RETENTION_DESCRIPTION = `Deleted records can be recovered from the Rubbish bin until this many days have passed, then they are permanently deleted. 1 to ${RUBBISH_BIN_MAX_RETENTION_DAYS} days.`;

/**
 * How long a deleted record waits in the Rubbish bin before the daily purge removes it (#298).
 * One window for every kind of record the organisation owns.
 */
export function RubbishBin_SettingsCard({
    organizationId,
    settings,
    canEdit,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    canEdit: boolean;
}) {
    const { retentionDays } = settings.rubbishBin;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Rubbish Bin</CardTitle>
            </CardHeader>
            <CardContent>
                <SettingRow
                    title="Keep deleted records for"
                    description={RETENTION_DESCRIPTION}
                    value={`${retentionDays} ${retentionDays === 1 ? "day" : "days"}`}
                    action={
                        canEdit && (
                            <OrganizationSettings_UpdateRubbishBin_Dialog
                                organizationId={organizationId}
                                settings={settings}
                                description={RETENTION_DESCRIPTION}
                            />
                        )
                    }
                />
            </CardContent>
        </Card>
    );
}
