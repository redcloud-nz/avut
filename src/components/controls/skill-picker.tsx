/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { Fragment, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { useOrganization } from "@/hooks/use-organization";
import { SkillData } from "@/lib/schemas/skill";
import { SkillGroupData } from "@/lib/schemas/skill-group";
import { trpc } from "@/trpc/client";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

interface SkillPickerProps {
    className?: string;

    defaultValue?: string;

    exclude?: string[];

    onValueChange?: (skill: SkillData) => void;

    placeholder?: string;

    size?: "default" | "sm";

    value?: string;
}

export function SkillPicker({
    className,
    defaultValue = "",
    exclude = [],
    onValueChange,
    placeholder,
    size,
    value,
}: SkillPickerProps) {
    const organization = useOrganization();

    const query = useQuery(
        trpc.skills.getAvailablePackages.queryOptions({
            orgId: organization.orgId,
        }),
    );

    const [internalValue, setInternalValue] = useState<string>(
        value ?? defaultValue,
    );

    const packages = query.data || [];
    const skills = packages.flatMap((sp) => sp.skills);

    function handleSelect(skillId: string) {
        if (skillId != internalValue) {
            setInternalValue(skillId);
            const skill = skills.find((s) => s.skillId === skillId)!;
            if (skill && onValueChange) {
                onValueChange(skill);
            }
        }
    }

    return (
        <Select
            defaultValue={defaultValue}
            onValueChange={handleSelect}
            value={internalValue}
        >
            <SelectTrigger className={className} size={size}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {packages.map((pkg) => (
                    <Fragment key={pkg.skillPackageId}>
                        {pkg.skillGroups
                            .filter((skillGroup) => skillGroup.parentId == null)
                            .map((skillGroup) => (
                                <SkillGroupSelectItems
                                    key={skillGroup.skillGroupId}
                                    exclude={exclude}
                                    parent={pkg.name}
                                    skillGroup={skillGroup}
                                    skills={pkg.skills}
                                />
                            ))}
                    </Fragment>
                ))}
            </SelectContent>
        </Select>
    );
}

function SkillGroupSelectItems({
    exclude,
    parent,
    skillGroup,
    skills,
}: {
    exclude: string[];
    parent: string;
    skillGroup: SkillGroupData;
    skills: SkillData[];
}) {
    return (
        <SelectGroup key={skillGroup.skillGroupId}>
            <SelectLabel>{`${parent} / ${skillGroup.name}`}</SelectLabel>
            {skills
                .filter(
                    (skill) => skill.skillGroupId == skillGroup.skillGroupId,
                )
                .map((skill) => (
                    <SelectItem
                        key={skill.skillId}
                        value={skill.skillId}
                        disabled={exclude.includes(skill.skillId)}
                    >
                        {skill.name}
                    </SelectItem>
                ))}
        </SelectGroup>
    );
}
