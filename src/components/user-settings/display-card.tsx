/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DLAction, DLActions, DLDetails, DLTerm } from "@/components/ui/description-list";
import { UserDisplay_UpdateDateFormat_Dialog } from "@/components/user-settings/update-date-format-dialog";
import { UserDisplay_UpdateTimeFormat_Dialog } from "@/components/user-settings/update-time-format-dialog";
import { DATE_FORMAT_PATTERNS, TIME_FORMAT_PATTERNS } from "@/lib/datetime";
import { UserSettings } from "@/lib/schemas/user-settings";

/** A fixed example instant, used only to render a live preview of each format preset. */
const PREVIEW_DATE = new Date(2026, 8, 24, 14, 30);

/**
 * Per-user display preferences — currently the date/time format presets called for in issue #93.
 * `dateFormat` and `timeFormat` are edited independently, each through its own dialog. Not yet
 * wired into `formatDate`/`formatDateTime` — see those functions' docstrings in
 * `src/lib/datetime.ts`.
 */
export function UserDisplay_SettingsCard({ settings }: { settings: UserSettings }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Display</CardTitle>
            </CardHeader>
            <CardContent>
                <DLActions>
                    <DLTerm>Date Format</DLTerm>
                    <DLDetails>
                        {format(PREVIEW_DATE, DATE_FORMAT_PATTERNS[settings.display.dateFormat])}
                    </DLDetails>
                    <DLAction>
                        <UserDisplay_UpdateDateFormat_Dialog settings={settings} />
                    </DLAction>

                    <DLTerm>Time Format</DLTerm>
                    <DLDetails>
                        {format(PREVIEW_DATE, TIME_FORMAT_PATTERNS[settings.display.timeFormat])}
                    </DLDetails>
                    <DLAction>
                        <UserDisplay_UpdateTimeFormat_Dialog settings={settings} />
                    </DLAction>
                </DLActions>
            </CardContent>
        </Card>
    );
}
