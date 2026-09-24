/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DLAction, DLActions, DLDetails, DLTerm } from "@/components/ui/description-list";
import { UserDisplay_UpdateSettings_Dialog } from "@/components/user-settings/update-display-settings-dialog";
import { DATE_FORMAT_PATTERNS, DATE_TIME_FORMAT_PATTERNS } from "@/lib/datetime";
import { UserSettings } from "@/lib/schemas/user-settings";

/** A fixed example instant, used only to render a live preview of each format preset. */
const PREVIEW_DATE = new Date(2026, 8, 24, 14, 30);

/**
 * Per-user display preferences — currently just the two date-format presets called for in
 * issue #93 (`dateFormat` for table/list columns, `dateTimeFormat` for fuller contexts like
 * entity created/updated times). Not yet wired into `formatDate`/`formatDateTime` — see those
 * functions' docstrings in `src/lib/datetime.ts`.
 */
export function UserDisplay_SettingsCard({ settings }: { settings: UserSettings }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Display</CardTitle>
            </CardHeader>
            <CardContent>
                <DLActions>
                    <DLTerm>Table dates</DLTerm>
                    <DLDetails>
                        {format(PREVIEW_DATE, DATE_FORMAT_PATTERNS[settings.display.dateFormat])}
                    </DLDetails>
                    <DLAction />

                    <DLTerm>Created/updated times</DLTerm>
                    <DLDetails>
                        {format(
                            PREVIEW_DATE,
                            DATE_TIME_FORMAT_PATTERNS[settings.display.dateTimeFormat],
                        )}
                    </DLDetails>
                    <DLAction>
                        <UserDisplay_UpdateSettings_Dialog settings={settings} />
                    </DLAction>
                </DLActions>
            </CardContent>
        </Card>
    );
}
