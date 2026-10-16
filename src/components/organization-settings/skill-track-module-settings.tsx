/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { defaultSkillCheckResultLabel } from "@/lib/schemas/skill-check-result";

import { Feature_SettingsCard } from "./feature-settings-card";
import { SKILL_TRACK_RESULT_GROUPS } from "./skill-track-result-groups";
import { OrganizationSettings_UpdateSkillTrackResults_Dialog } from "./update-skill-track-results";

const RESULTS_DESCRIPTION =
    "Which skill check results your organisation can record, and what each one is called.";

/**
 * The Skill Track module: Enable/Disable, and while it's enabled, a table of the result options
 * currently offered, grouped by tier. Disabled options are left out; the edit dialog lists them all.
 */
export function SkillTrackModule_SettingsCard({
    organizationId,
    settings,
    canEdit,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    canEdit: boolean;
}) {
    const { enabled, results } = settings.modules["skill-track"];

    return (
        <Feature_SettingsCard
            organizationId={organizationId}
            canEdit={canEdit}
            slice="modules.skill-track"
            enabled={enabled}
            kind="module"
            title="Skill Track Module"
            description="The Skill Track module provides functionality for managing skills and competencies within your organisation."
        >
            <div className="mb-3 flex items-start gap-4">
                <div className="min-w-0 flex-1">
                    <h4 className="text-sm/6 font-semibold text-foreground">
                        Skill Check Result Options
                    </h4>
                    <p className="text-sm text-muted-foreground">{RESULTS_DESCRIPTION}</p>
                </div>
                {canEdit && (
                    <OrganizationSettings_UpdateSkillTrackResults_Dialog
                        organizationId={organizationId}
                        settings={settings}
                        description={RESULTS_DESCRIPTION}
                    />
                )}
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHeadCell>Tier</TableHeadCell>
                        <TableHeadCell>Result</TableHeadCell>
                        <TableHeadCell>Shown as</TableHeadCell>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {SKILL_TRACK_RESULT_GROUPS.flatMap((group) => {
                        const enabledValues = group.values.filter(
                            (value) => results[value].enabled,
                        );
                        // The tier cell spans the group's rows, so it's rendered on the first only.
                        const tierCell = (
                            <TableHeadCell
                                rowSpan={Math.max(enabledValues.length, 1)}
                                scope="rowgroup"
                                className="h-auto p-2 align-top"
                            >
                                {group.label}
                            </TableHeadCell>
                        );

                        if (enabledValues.length === 0) {
                            return [
                                <TableRow key={group.label}>
                                    {tierCell}
                                    <TableCell colSpan={2} className="text-muted-foreground">
                                        None enabled
                                    </TableCell>
                                </TableRow>,
                            ];
                        }

                        return enabledValues.map((value, index) => (
                            <TableRow key={value}>
                                {index === 0 && tierCell}
                                <TableCell>{defaultSkillCheckResultLabel(value)}</TableCell>
                                <TableCell>{results[value].label}</TableCell>
                            </TableRow>
                        ));
                    })}
                </TableBody>
            </Table>
        </Feature_SettingsCard>
    );
}
