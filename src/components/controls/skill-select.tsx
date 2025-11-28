/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";

import {
    S2_SelectContent,
    S2_SelectGroup,
    S2_SelectItem,
    S2_SelectLabel,
} from "@/components/ui/s2-select";
import { RouterOutput } from "@/trpc/client";

type SkillSelectContentProps = Omit<
    ComponentProps<typeof S2_SelectContent>,
    "children"
> & {
    skillPackages: RouterOutput["skills"]["getAvailablePackages"];
};

export function SkillSelectContent({
    skillPackages,
    ...props
}: SkillSelectContentProps) {
    return (
        <S2_SelectContent {...props}>
            {skillPackages.map((skillPackage) =>
                skillPackage.skillGroups.map((skillGroup) => (
                    <S2_SelectGroup key={skillGroup.skillGroupId}>
                        <S2_SelectLabel>
                            {skillPackage.name} / {skillGroup.name}
                        </S2_SelectLabel>
                        {skillPackage.skills
                            .filter(
                                (skill) =>
                                    skill.skillGroupId ===
                                    skillGroup.skillGroupId,
                            )
                            .map((skill) => (
                                <S2_SelectItem
                                    key={skill.skillId}
                                    value={skill.skillId}
                                >
                                    {skill.name}
                                </S2_SelectItem>
                            ))}
                    </S2_SelectGroup>
                )),
            )}
        </S2_SelectContent>
    );
}
