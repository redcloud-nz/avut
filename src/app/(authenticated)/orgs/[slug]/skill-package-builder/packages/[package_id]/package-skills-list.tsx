/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { eq, useLiveQuery } from "@tanstack/react-db";

import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Show } from "@/components/show";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { getSkillsCollection } from "@/lib/collections/skills";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";

interface SkillPackageBuilder_Package_Skills_ListProps {
    skillPackageId: SkillPackageId;
}

/**
 * Component to display a list of skills within a skill package, along with their associated groups.
 * Provides a button to create new skills within the package.
 * @param skillPackageId The ID of the skill package whose skills are being displayed.
 * @returns A React component displaying the skills in a table format, or an alert if no skills are present.
 */
export function SkillPackageBuilder_Package_Skills_List({
    skillPackageId,
}: SkillPackageBuilder_Package_Skills_ListProps) {
    const organization = useOrganization();

    const { data: skills, isReady } = useLiveQuery((q) =>
        q
            .from({ skill: getSkillsCollection(organization.id) })
            .join(
                { skillGroup: getSkillGroupsCollection(organization.id) },
                ({ skill, skillGroup }) =>
                    eq(skill.skillGroupId, skillGroup.id),
            )
            .where(({ skill }) => eq(skill.skillPackageId, skillPackageId))
            .select(({ skill, skillGroup }) => ({
                ...skill,
                skillGroup,
            })),
    );

    const packagePath = Paths.org(
        organization.slug,
    ).skillPackageBuilder.skillPackage(skillPackageId);

    return (
        <Hermes.Section>
            <Hermes.SectionHeader>
                <Hermes.SectionTitle>Skills</Hermes.SectionTitle>
                <Button variant="outline" asChild>
                    <Link to={packagePath.skills.create({})}>
                        <ObjectIcons.Create /> Skill
                    </Link>
                </Button>
            </Hermes.SectionHeader>
            <Show
                when={isReady}
                fallback={<Skeleton className="w-full h-13 mb-4" />}
            >
                {skills.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell>Name</TableHeadCell>
                                <TableHeadCell>Group</TableHeadCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {skills.map((skill) => {
                                return (
                                    <TableRow key={skill.id}>
                                        <TableCell>
                                            <Link
                                                to={Paths.org(organization.slug)
                                                    .skillPackageBuilder.skillPackage(
                                                        skill.skillPackageId,
                                                    )
                                                    .skill(skill.id)}
                                            >
                                                {skill.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            {skill.skillGroup?.name}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                ) : (
                    <Alert
                        severity="info"
                        title="No skills have been created for this package yet."
                    />
                )}
            </Show>
        </Hermes.Section>
    );
}
