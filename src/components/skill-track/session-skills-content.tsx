/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import * as R from "remeda";
import { toast } from "sonner";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";

import { skillsInvalidations, skillsWrites } from "@/client/skills-invalidations";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillId } from "@/lib/schemas/skill";
import { trpc } from "@/trpc/client";

/**
 * Content for selecting skills to be assessed in a skill check session.
 * Displays a list of skill packages, each collapsible and containing skill groups and skills.
 * Each skill has a checkbox to select/deselect it for the session. Changes are saved
 * automatically with a debounce, and the UI indicates pending changes and errors.
 */
export function SkillTrack_SessionSkills_Content({
    sessionId,
}: {
    sessionId: SkillCheckSessionId;
}) {
    const organization = useOrganization();

    const [
        {
            data: { skills, skillGroups, skillPackages },
        },
        { data: session },
        { data: assignedSkills },
    ] = useSuspenseQueries({
        queries: [
            trpc.skills.listAssessableSkills.queryOptions({
                organizationId: organization.id,
            }),
            trpc.skills.getSession.queryOptions({
                organizationId: organization.id,
                skillCheckSessionId: sessionId,
            }),
            trpc.skills.listSessionSkills.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
                scope: "assigned",
            }),
        ],
    });

    const mutation = useMutation(
        trpc.skills.updateSessionSkills.mutationOptions({
            meta: {
                invalidates: skillsInvalidations.updateSessionSkills,
                writes: skillsWrites.updateSessionSkills,
            },
            onError(error) {
                console.error("Failed to update session skills:", error);
                toast.error(`Failed to update session skills. ${error.message}`);
            },
            onSuccess() {
                setChanges({});
            },
        }),
    );

    const debouncer = useDebouncer(mutation.mutate, { wait: 2000 });

    const [changes, setChanges] = useState<Record<SkillId, boolean>>({});
    const [showSkillDescription, setShowSkillDescription] = useState(false);

    const assignedSkillIds = assignedSkills.map((s) => s.id);

    function isSelected(skillId: SkillId): boolean {
        return changes[skillId] ?? assignedSkillIds.includes(skillId);
    }

    function handleChangeChecked(skillId: SkillId, newValue: boolean) {
        if (mutation.status == "success") {
            mutation.reset();
        }

        const previousValue = assignedSkillIds.includes(skillId);

        let updatedChanges: typeof changes;
        if (newValue === previousValue) {
            // If the new value matches the previous value, remove it from changes (no change needed)
            const { [skillId]: _, ...rest } = changes;
            updatedChanges = rest;
        } else {
            // Otherwise, record the change
            updatedChanges = { ...changes, [skillId]: newValue };
        }

        setChanges(updatedChanges);

        debouncer.maybeExecute({
            organizationId: organization.id,
            skillCheckSessionId: sessionId,
            addedSkillIds: Object.entries(updatedChanges)
                .filter(([_, selected]) => selected)
                .map(([id, _]) => id as SkillId),
            removedSkillIds: Object.entries(updatedChanges)
                .filter(([_, selected]) => !selected)
                .map(([id, _]) => id as SkillId),
        });
    }

    // Package -> group -> skills. Packages are ordered by name, groups and skills by their
    // authored sequence. Groups and packages left with no skills are dropped.
    const packageSections = R.pipe(
        skillPackages,
        R.sortBy((skillPackage) => skillPackage.name),
        R.map((skillPackage) => ({
            skillPackage,
            groups: R.pipe(
                skillGroups,
                R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
                R.sortBy((skillGroup) => skillGroup.sequence),
                R.map((skillGroup) => ({
                    skillGroup,
                    skills: R.pipe(
                        skills.filter((skill) => skill.skillGroupId === skillGroup.id),
                        R.sortBy((skill) => skill.name),
                    ),
                })),
                R.filter(({ skills }) => skills.length > 0),
            ),
        })),
        R.filter(({ groups }) => groups.length > 0),
    );

    return (
        <>
            <Std.Navbar>
                <Std.Breadcrumbs
                    breadcrumbs={[
                        {
                            label: "Skill Track",
                            href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
                        },
                        {
                            label: "Sessions",
                            href: route("/orgs/[slug]/skill-track/sessions", {
                                slug: organization.slug,
                            }),
                        },
                        {
                            label: session.name,
                            href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                                slug: organization.slug,
                                session_id: sessionId,
                            }),
                        },
                        "Skills",
                    ]}
                />
                <div className="flex justify-end grow">
                    <SaveStatusIndicator status={mutation.status} />
                </div>
            </Std.Navbar>
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Session Skills</Saratoga.Title>
                        <Saratoga.Actions>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost">
                                        <DropdownMenuTriggerIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Show</DropdownMenuLabel>
                                        <DropdownMenuCheckboxItem
                                            checked={showSkillDescription}
                                            onCheckedChange={setShowSkillDescription}
                                        >
                                            <span>Skill Description</span>
                                        </DropdownMenuCheckboxItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <div className="mt-6 space-y-6">
                        {packageSections.map(({ skillPackage, groups }) => {
                            const skillsInPackage = groups.flatMap(({ skills }) => skills);
                            const packageSelectedCount = skillsInPackage.filter((s) =>
                                isSelected(s.id),
                            ).length;

                            return (
                                <Collapsible key={skillPackage.id} defaultOpen>
                                    <CollapsibleTrigger className="group w-full flex items-center justify-between gap-2 font-semibold border-b pb-1 hover:text-accent-foreground">
                                        <span>{skillPackage.name}</span>
                                        <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                                            <span>
                                                {packageSelectedCount} of {skillsInPackage.length}{" "}
                                                selected
                                            </span>
                                            <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                                        </span>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="space-y-6 pt-4">
                                            {groups.map(({ skillGroup, skills }) => (
                                                <div key={skillGroup.id}>
                                                    <div className="text-sm font-medium text-muted-foreground mb-2">
                                                        {skillGroup.name}
                                                    </div>
                                                    <FieldGroup>
                                                        {skills.map((skill) => (
                                                            <Field
                                                                orientation="horizontal"
                                                                key={skill.id}
                                                            >
                                                                <Checkbox
                                                                    id={`skill-${skill.id}`}
                                                                    checked={isSelected(skill.id)}
                                                                    onCheckedChange={(checked) =>
                                                                        handleChangeChecked(
                                                                            skill.id,
                                                                            !!checked,
                                                                        )
                                                                    }
                                                                />
                                                                <FieldContent>
                                                                    <FieldLabel
                                                                        htmlFor={`skill-${skill.id}`}
                                                                    >
                                                                        {skill.name}
                                                                    </FieldLabel>
                                                                    {showSkillDescription &&
                                                                        skill.description && (
                                                                            <FieldDescription>
                                                                                {skill.description}
                                                                            </FieldDescription>
                                                                        )}
                                                                </FieldContent>
                                                            </Field>
                                                        ))}
                                                    </FieldGroup>
                                                </div>
                                            ))}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            );
                        })}
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
