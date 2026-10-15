/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

/**
 * One read-only setting in an organization-settings card: the title and its explanation across
 * the full width, with the current value and (for editors) the edit dialog's trigger on the
 * right. Rows separate themselves with a top border, as `DataItem` does.
 */
export function SettingRow({
    title,
    description,
    value,
    action,
}: {
    title: ReactNode;
    description?: ReactNode;
    /** The current value: for on/off settings an `OrganizationSettings_SettingSwitch` (editors) or `SettingEnabledBadge` (viewers); plain text otherwise. */
    value: ReactNode;
    /** The edit dialog, or nothing for a viewer without `canEdit`. */
    action?: ReactNode;
}) {
    return (
        <div
            data-component="SettingRow"
            className="flex items-start gap-4 border-t border-border/50 py-3 text-sm/6 first:border-none first:pt-0 last:pb-0"
        >
            <div className="min-w-0 flex-1">
                <div className="font-medium text-foreground">{title}</div>
                {description && <p className="text-muted-foreground">{description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                <div className="text-foreground">{value}</div>
                {action}
            </div>
        </div>
    );
}

/** The value of an on/off setting, for `SettingRow`'s `value`. */
export function SettingEnabledBadge({ enabled }: { enabled: boolean }) {
    return (
        <Badge variant={enabled ? "default" : "outline"}>{enabled ? "Enabled" : "Disabled"}</Badge>
    );
}
