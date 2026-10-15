/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { SettingEnabledBadge, SettingRow } from "./setting-row";
import { OrganizationSettings_SettingSwitch } from "./setting-switch";

const LINK_ON_ACCEPT_DESCRIPTION =
    "When someone accepts an invitation, attach them to the person record with the same email address, if there is one.";

const LINK_ON_CREATE_DESCRIPTION =
    "When a person is added, attach them to the account of an existing member with the same email address. Someone who is not already a member is never added to the organisation — invite them from their person record instead.";

/**
 * When AVUT may attach a person record to a user account on its own.
 *
 * Both settings are off by default and neither ever grants membership — they only fill in the
 * link on a membership that already exists. Inviting someone from their person record works
 * regardless of these settings.
 */
export function Personnel_SettingsCard({
    organizationId,
    settings,
    canEdit,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    canEdit: boolean;
}) {
    const { autoLinkOnInviteAccept, autoLinkOnPersonCreate } = settings.personnel;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Personnel</CardTitle>
            </CardHeader>
            <CardContent>
                <SettingRow
                    title="Link on invitation accept"
                    description={LINK_ON_ACCEPT_DESCRIPTION}
                    value={
                        canEdit ? (
                            <OrganizationSettings_SettingSwitch
                                organizationId={organizationId}
                                slice="personnel"
                                field="autoLinkOnInviteAccept"
                                value={autoLinkOnInviteAccept}
                                label="Link on invitation accept"
                            />
                        ) : (
                            <SettingEnabledBadge enabled={autoLinkOnInviteAccept} />
                        )
                    }
                />
                <SettingRow
                    title="Link when a person is added"
                    description={LINK_ON_CREATE_DESCRIPTION}
                    value={
                        canEdit ? (
                            <OrganizationSettings_SettingSwitch
                                organizationId={organizationId}
                                slice="personnel"
                                field="autoLinkOnPersonCreate"
                                value={autoLinkOnPersonCreate}
                                label="Link when a person is added"
                            />
                        ) : (
                            <SettingEnabledBadge enabled={autoLinkOnPersonCreate} />
                        )
                    }
                />
            </CardContent>
        </Card>
    );
}
