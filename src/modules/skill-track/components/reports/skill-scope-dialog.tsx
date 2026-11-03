/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { TelescopeIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";

import { PickerDialog } from "@/components/picker-dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/hooks/use-organization";
import { skillSectionLabel } from "@/modules/skill-track/lib/skill-sections";
import { trpc } from "@/trpc/client";

/**
 * Scope picker for the Skill Coverage report, presented as a command dialog. Opened via
 * `?action=select-scope` (or forced open when no skill is picked yet); choosing a skill
 * sets `?skill=<id>`. A team filter (`?team=<id>`, absent = whole organization) is folded
 * in as a select at the top of the dialog.
 */
export function SkillTrack_SkillScopeDialog({
    forceOpen = false,
    label = "Change scope",
    compact = false,
}: {
    forceOpen?: boolean;
    label?: string;
    /** Hide the trigger button below `sm` — the report offers it in the dropdown menu instead. */
    compact?: boolean;
}) {
    const [, setSkill] = useQueryState("skill");

    return (
        <PickerDialog
            action="select-scope"
            forceOpen={forceOpen}
            icon={<TelescopeIcon />}
            label={label}
            compact={compact}
            title="Select a skill"
            description="Choose a skill to see who currently holds it."
        >
            {({ close }) => (
                <SkillScope_Picker
                    onSelect={(skillId) => {
                        void setSkill(skillId, { history: "push" });
                        close();
                    }}
                />
            )}
        </PickerDialog>
    );
}

/**
 * The team filter and skill list, rendered inside `DialogContent` so their queries only run once
 * the dialog opens — the dialog is always mounted in the report header.
 */
function SkillScope_Picker({ onSelect }: { onSelect: (skillId: string) => void }) {
    const organization = useOrganization();
    const [teamParam, setTeamParam] = useQueryState("team");

    const { data: teams } = useSuspenseQuery(
        trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
    );
    // Only Active teams are offered as a new scope; an existing `?team=` naming an
    // Archived team still validates below so a saved/linked scope keeps resolving.
    const activeTeams = teams.filter((team) => team.status === "Active");

    const {
        data: { skillPackages, skillGroups, skills },
    } = useSuspenseQuery(
        trpc.skillPackageSubscriptions.listAssessableSkills.queryOptions({
            organizationId: organization.id,
        }),
    );

    // Package -> group -> skill, flattened to a single "Package · Group" heading per section.
    const groupSections = R.pipe(
        skillPackages,
        R.sortBy((skillPackage) => skillPackage.name),
        R.flatMap((skillPackage) =>
            R.pipe(
                skillGroups,
                R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
                R.sortBy((skillGroup) => skillGroup.sequence),
                R.flatMap((skillGroup) => {
                    const groupSkills = R.pipe(
                        skills,
                        R.filter((skill) => skill.skillGroupId === skillGroup.id),
                        R.sortBy((skill) => skill.sequence),
                    );
                    if (groupSkills.length === 0) return [];
                    return [
                        {
                            id: skillGroup.id,
                            label: skillSectionLabel(skillPackage, skillGroup),
                            skills: groupSkills,
                        },
                    ];
                }),
            ),
        ),
    );

    // A malformed `?team=` isn't one of the SelectItem values, so fall back to whole-org —
    // matching how the report itself treats an unparseable team id.
    const currentTeamValue =
        teamParam && teams.some((team) => team.id === teamParam) ? teamParam : "all";
    // A saved/linked scope naming an Archived team still resolves and needs its own option so
    // the Select can show its name, even though it isn't offered as a new selection.
    const selectableTeams = activeTeams.some((team) => team.id === currentTeamValue)
        ? activeTeams
        : [...activeTeams, ...teams.filter((team) => team.id === currentTeamValue)];

    return (
        <>
            <div className="flex items-center gap-2 border-b px-4 py-3">
                <Label htmlFor="skill-scope-team" className="text-muted-foreground">
                    Team
                </Label>
                <Select
                    value={currentTeamValue}
                    onValueChange={(value) =>
                        void setTeamParam(value === "all" ? null : value, {
                            history: "replace",
                        })
                    }
                >
                    <SelectTrigger id="skill-scope-team" size="sm" className="flex-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Whole Organisation</SelectItem>
                        {R.pipe(
                            selectableTeams,
                            R.sortBy((team) => team.name),
                            R.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                </SelectItem>
                            )),
                        )}
                    </SelectContent>
                </Select>
            </div>
            <Command className="max-sm:min-h-0 max-sm:flex-1">
                <CommandInput placeholder="Search skills…" />
                <CommandList className="max-sm:max-h-none max-sm:flex-1 sm:h-72">
                    <CommandEmpty>No skills match your search.</CommandEmpty>
                    {groupSections.map((section) => (
                        <CommandGroup key={section.id} heading={section.label}>
                            {section.skills.map((skill) => (
                                <CommandItem
                                    key={skill.id}
                                    value={`${skill.name} ${section.label}`}
                                    onSelect={() => onSelect(skill.id)}
                                >
                                    {skill.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ))}
                </CommandList>
            </Command>
        </>
    );
}
