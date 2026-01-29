/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";

import {
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
} from "@/components/ui/select";
import { RouterOutput } from "@/trpc/client";

type SkillSelectContentProps = Omit<
    ComponentProps<typeof SelectContent>,
    "children"
> & {
    skillPackages: RouterOutput["skills"]["getAvailablePackages"];
};

export function SkillSelectContent({
    skillPackages,
    ...props
}: SkillSelectContentProps) {
    return (
        <SelectContent {...props}>
            {skillPackages.map((skillPackage) =>
                skillPackage.skillGroups.map((skillGroup) => (
                    <SelectGroup key={skillGroup.skillGroupId}>
                        <SelectLabel>
                            {skillPackage.name} / {skillGroup.name}
                        </SelectLabel>
                        {skillPackage.skills
                            .filter(
                                (skill) =>
                                    skill.skillGroupId ===
                                    skillGroup.skillGroupId,
                            )
                            .map((skill) => (
                                <SelectItem
                                    key={skill.skillId}
                                    value={skill.skillId}
                                >
                                    {skill.name}
                                </SelectItem>
                            ))}
                    </SelectGroup>
                )),
            )}
        </SelectContent>
    );
}
