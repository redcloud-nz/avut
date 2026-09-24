/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemAction, DataItemTitle, DataItemValue } from "@/components/ui/data-item";
import { UserDisplay_UpdateDateFormat_Dialog } from "@/components/user-settings/update-date-format-dialog";
import { UserDisplay_UpdateTimeFormat_Dialog } from "@/components/user-settings/update-time-format-dialog";
import {
    DATE_FORMAT_LABELS,
    DATE_FORMAT_PATTERNS,
    TIME_FORMAT_LABELS,
    TIME_FORMAT_PATTERNS,
} from "@/lib/datetime";
import { UserSettings } from "@/lib/schemas/user-settings";

/** A fixed example instant, used only to render a live preview of each format preset. */
const PREVIEW_DATE = new Date(2026, 8, 24, 14, 30);

/**
 * Per-user display preferences — currently the date/time format presets called for in issue #93.
 * `dateFormat` and `timeFormat` are edited independently, each through its own dialog. Not yet
 * wired into `formatDate`/`formatDateTime` — see those functions' docstrings in
 * `src/lib/datetime.ts`.
 */
export function UserDateTime_SettingsCard({ settings }: { settings: UserSettings }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Date/Time</CardTitle>
            </CardHeader>
            <CardContent>
                <DataItem>
                    <DataItemTitle>Date Format</DataItemTitle>
                    <DataItemValue>
                        {DATE_FORMAT_LABELS[settings.display.dateFormat]}
                        <br />
                        <span className="text-muted-foreground">
                            {format(
                                PREVIEW_DATE,
                                DATE_FORMAT_PATTERNS[settings.display.dateFormat],
                            )}
                        </span>
                    </DataItemValue>
                    <DataItemAction>
                        <UserDisplay_UpdateDateFormat_Dialog settings={settings} />
                    </DataItemAction>
                </DataItem>

                <DataItem>
                    <DataItemTitle>Time Format</DataItemTitle>
                    <DataItemValue>
                        {TIME_FORMAT_LABELS[settings.display.timeFormat]}
                        <br />
                        <span className="text-muted-foreground">
                            {format(
                                PREVIEW_DATE,
                                TIME_FORMAT_PATTERNS[settings.display.timeFormat],
                            )}
                        </span>
                    </DataItemValue>
                    <DataItemAction>
                        <UserDisplay_UpdateTimeFormat_Dialog settings={settings} />
                    </DataItemAction>
                </DataItem>
            </CardContent>
        </Card>
    );
}
