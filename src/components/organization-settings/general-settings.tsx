/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { SettingRow } from "./setting-row";
import { OrganizationSettings_UpdateReplyTo_Dialog } from "./update-reply-to";
import { OrganizationSettings_UpdateTimeZone_Dialog } from "./update-time-zone";

const TIME_ZONE_DESCRIPTION =
    "The zone your organisation operates in. Skill check session start and end times are entered and shown in it.";

const REPLY_TO_DESCRIPTION =
    "Where replies go when someone answers an email your organisation sends, such as an invitation, an I3 receipt or an attendance reminder. Those emails come from a no-reply address, so without one replies go nowhere.";

/**
 * Settings that apply across the organisation: the time zone sessions are timed in, and the
 * Reply-To address on the emails it sends.
 */
export function General_SettingsCard({
    organizationId,
    settings,
    canEdit,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    canEdit: boolean;
}) {
    const { timeZone, replyTo } = settings.general;
    const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value;

    return (
        <Card>
            <CardContent>
                <SettingRow
                    title="Time zone"
                    description={TIME_ZONE_DESCRIPTION}
                    value={offset ? `${timeZone} (${offset})` : timeZone}
                    action={
                        canEdit && (
                            <OrganizationSettings_UpdateTimeZone_Dialog
                                organizationId={organizationId}
                                settings={settings}
                                description={TIME_ZONE_DESCRIPTION}
                            />
                        )
                    }
                />
                <SettingRow
                    title="Reply-To address"
                    description={REPLY_TO_DESCRIPTION}
                    value={replyTo ?? "Not set — replies aren't read"}
                    action={
                        canEdit && (
                            <OrganizationSettings_UpdateReplyTo_Dialog
                                organizationId={organizationId}
                                settings={settings}
                                description={REPLY_TO_DESCRIPTION}
                            />
                        )
                    }
                />
            </CardContent>
        </Card>
    );
}
