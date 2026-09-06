/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { TelescopeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { useOrganization } from "@/hooks/use-organization";
import { cn } from "@/lib/utils";
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
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["select-scope"] as const),
    );
    const [, setSkill] = useQueryState("skill");
    const [teamParam, setTeamParam] = useQueryState("team");

    // `forceOpen` (report has no scope yet) shows the dialog on arrival, but it stays
    // dismissable — Escape leaves the blank report with its prompt and the trigger button to
    // reopen. `?action=select-scope` opens it explicitly regardless.
    const [dismissed, setDismissed] = useState(false);
    const open = action === "select-scope" || (forceOpen && !dismissed);

    const { data: teams } = useSuspenseQuery(
        trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
    );

    const {
        data: { skillPackages, skillGroups, skills },
    } = useSuspenseQuery(
        trpc.skills.listAssessableSkills.queryOptions({ organizationId: organization.id }),
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
                            label: `${skillPackage.name} · ${skillGroup.name}`,
                            skills: groupSkills,
                        },
                    ];
                }),
            ),
        ),
    );

    const currentTeamValue = teamParam ?? "all";

    function handleOpenChange(next: boolean) {
        setDismissed(!next);
        void setAction(next ? "select-scope" : null, { history: next ? "push" : "replace" });
    }

    function handleSelectSkill(skillId: string) {
        setDismissed(true);
        void setSkill(skillId, { history: "push" });
        void setAction(null, { history: "replace" });
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Button
                variant="outline"
                onClick={() => handleOpenChange(true)}
                className={cn(compact && "max-sm:hidden")}
            >
                <TelescopeIcon />
                <span className="sr-only sm:not-sr-only">{label}</span>
            </Button>
            <DialogContent className="gap-0 p-0">
                <DialogHeader className="border-b px-4 py-3">
                    <DialogTitle>Select a skill</DialogTitle>
                    <DialogDescription>
                        Choose a skill to see who currently holds it.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 border-b px-4 py-3">
                    <Label htmlFor="skill-scope-team" className="text-muted-foreground">
                        Team
                    </Label>
                    <Select
                        value={currentTeamValue}
                        onValueChange={(value) =>
                            setTeamParam(value === "all" ? null : value, { history: "replace" })
                        }
                    >
                        <SelectTrigger id="skill-scope-team" size="sm" className="flex-1">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Whole Organization</SelectItem>
                            {R.pipe(
                                teams,
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
                <Command>
                    <CommandInput placeholder="Search skills…" />
                    <CommandList className="h-72">
                        <CommandEmpty>No skills match your search.</CommandEmpty>
                        {groupSections.map((section) => (
                            <CommandGroup key={section.id} heading={section.label}>
                                {section.skills.map((skill) => (
                                    <CommandItem
                                        key={skill.id}
                                        value={`${skill.name} ${section.label}`}
                                        onSelect={() => handleSelectSkill(skill.id)}
                                    >
                                        {skill.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
