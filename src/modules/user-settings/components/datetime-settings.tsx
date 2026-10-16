/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemAction,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import {
    DATE_FORMAT_LABELS,
    DATE_FORMAT_PATTERNS,
    formatDateTime,
    TIME_FORMAT_LABELS,
    TIME_FORMAT_PATTERNS,
} from "@/lib/datetime";
import { UserSettings } from "@/lib/schemas/user-settings";

import { UserSettings_UpdateDateFormat_Dialog } from "./update-date-format";
import { UserSettings_UpdateTimeFormat_Dialog } from "./update-time-format";
import { UserSettings_UpdateTimeZone_Dialog } from "./update-timezone";

/** A fixed example instant, used only to render a live preview of each format preset. */
const PREVIEW_DATE = new Date(2026, 8, 24, 14, 30);

/**
 * Per-user display preferences — the date/time format presets and time zone called for in issue
 * #93. Each field is edited independently, through its own dialog. Wired into
 * `formatDate`/`formatDateTime`/`DataItemDateValue` via `usePreferences()` — see `src/lib/datetime.ts`.
 */
export function UserSettings_DateTime_Card({ settings }: { settings: UserSettings }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Date/Time</CardTitle>
            </CardHeader>
            <CardContent>
                <DataList>
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
                            <UserSettings_UpdateDateFormat_Dialog settings={settings} />
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
                            <UserSettings_UpdateTimeFormat_Dialog settings={settings} />
                        </DataItemAction>
                    </DataItem>

                    <DataItem>
                        <DataItemTitle>Time Zone</DataItemTitle>
                        <DataItemValue>
                            {settings.display.timeZone}
                            <br />
                            <span className="text-muted-foreground">
                                {formatDateTime(PREVIEW_DATE, settings.display)}
                            </span>
                        </DataItemValue>
                        <DataItemAction>
                            <UserSettings_UpdateTimeZone_Dialog settings={settings} />
                        </DataItemAction>
                    </DataItem>
                </DataList>
            </CardContent>
        </Card>
    );
}
