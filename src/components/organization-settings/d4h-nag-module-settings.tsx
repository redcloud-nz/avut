/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";

import { useOrganization } from "@/hooks/use-organization";
import type { OrganizationModuleId } from "@/lib/modules";
import { route } from "@/lib/routes";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { trpc } from "@/trpc/client";

import { Feature_SettingsCard } from "./feature-settings-card";
import { SettingRow } from "./setting-row";
import { OrganizationSettings_UpdateD4HNagToken_Dialog } from "./update-d4h-nag-token";

const TOKEN_DESCRIPTION =
    "The organisation D4H access token scheduled reminders use to read exercises and attendance. It must be able to see each team that has a reminder rule.";

/**
 * The D4H Attendance Reminders module: Enable/Disable (it requires the D4H module), and while
 * it's enabled, the D4H token its unattended runs use.
 *
 * The token row resolves the stored id against the org's own token list, which needs
 * `organization: ["update"]` in the org itself. A system admin (`systemAdmin`) can't call that
 * list, and a viewer without `canEdit` isn't allowed to, so for both the row shows only whether a
 * token is set.
 */
export function D4HNagModule_SettingsCard({
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
    /** Rendered on the system-admin page, where the org-scoped token list isn't reachable. */
    systemAdmin?: boolean;
}) {
    const { enabled, d4hTokenId } = settings.modules["d4h-nag"];

    return (
        <Feature_SettingsCard
            organizationId={organizationId}
            canEdit={canEdit}
            slice="modules.d4h-nag"
            enabled={enabled}
            isModuleEnabled={isModuleEnabled}
            kind="module"
            title="D4H Attendance Reminders Module"
            description="Emails members who haven't answered their D4H exercise invitation, on a schedule you set for each team."
        >
            {canEdit && !systemAdmin ? (
                <D4HNagTokenRow organizationId={organizationId} d4hTokenId={d4hTokenId} />
            ) : (
                <SettingRow
                    title="D4H token"
                    description={TOKEN_DESCRIPTION}
                    value={d4hTokenId ? "Set" : "None"}
                />
            )}
        </Feature_SettingsCard>
    );
}

/** The editable token row: the token's label, "None", or "Token not found" for a stale id. */
function D4HNagTokenRow({
    organizationId,
    d4hTokenId,
}: {
    organizationId: OrganizationId;
    d4hTokenId: string | null;
}) {
    const { slug } = useOrganization();
    const { data: tokens } = useQuery(
        trpc.d4hAccessTokens.listOrganizationAccessTokens.queryOptions({ organizationId }),
    );

    // While the list loads (or if it fails), fall back to the summary the read-only row shows.
    let value: string;
    if (!tokens) value = d4hTokenId ? "Set" : "None";
    else if (d4hTokenId === null) value = tokens.length === 0 ? "No tokens" : "None";
    else value = tokens.find((token) => token.id === d4hTokenId)?.label ?? "Token not found";

    const noTokens = tokens?.length === 0;

    return (
        <SettingRow
            title="D4H token"
            description={
                <>
                    {TOKEN_DESCRIPTION}
                    {noTokens && (
                        <span className="mt-1 block">
                            This organisation has no D4H access tokens yet.{" "}
                            <Link
                                href={route("/orgs/[slug]/admin/d4h-access-tokens", { slug })}
                                className="underline underline-offset-4 hover:text-foreground"
                            >
                                Add one on the D4H access tokens page
                            </Link>
                            .
                        </span>
                    )}
                </>
            }
            value={value}
            action={
                <OrganizationSettings_UpdateD4HNagToken_Dialog
                    organizationId={organizationId}
                    d4hTokenId={d4hTokenId}
                    description={TOKEN_DESCRIPTION}
                />
            }
        />
    );
}
