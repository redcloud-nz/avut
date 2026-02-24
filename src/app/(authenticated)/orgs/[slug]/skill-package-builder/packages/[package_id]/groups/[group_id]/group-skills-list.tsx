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
import { getSkillsCollection } from "@/lib/collections/skills";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";

import * as Paths from "@/paths";

interface SkillPackageBuilder_Group_Skills_ListProps {
    skillPackageId: SkillPackageId;
    skillGroupId: SkillGroupId;
}

/**
 * Component to display a list of skills within a skill group.
 * Provides a button to create new skills within the group.
 * @param skillGroupId The ID of the skill group whose skills are being displayed.
 * @returns A React component displaying the skills in a table format, or an alert if no skills are present.
 */
export function SkillPackageBuilder_Group_Skills_List({
    skillPackageId,
    skillGroupId,
}: SkillPackageBuilder_Group_Skills_ListProps) {
    const organization = useOrganization();

    const { data: skills, isReady } = useLiveQuery((q) =>
        q
            .from({ skill: getSkillsCollection(organization.id) })
            .where(({ skill }) => eq(skill.skillGroupId, skillGroupId))
            .orderBy(({ skill }) => skill.sequence),
    );

    const packagePath = Paths.org(
        organization.slug,
    ).skillPackageBuilder.skillPackage(skillPackageId);

    return (
        <Hermes.Section>
            <Hermes.SectionHeader>
                <Hermes.SectionTitle>Skills</Hermes.SectionTitle>
                <Button variant="outline" asChild>
                    <Link
                        to={packagePath.skills.create({
                            groupId: skillGroupId,
                        })}
                    >
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
                                <TableHeadCell className="w-20 text-center">
                                    Sequence
                                </TableHeadCell>
                                <TableHeadCell>Name</TableHeadCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {skills.map((skill) => (
                                <TableRow key={skill.id}>
                                    <TableCell className="text-center">
                                        {skill.sequence}
                                    </TableCell>
                                    <TableCell>
                                        <Link
                                            to={Paths.org(organization.slug)
                                                .skillPackageBuilder.skillPackage(
                                                    skillPackageId,
                                                )
                                                .skill(skill.id)}
                                        >
                                            {skill.name}
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <Alert
                        severity="info"
                        title="No skills have been added to this group yet."
                    />
                )}
            </Show>
        </Hermes.Section>
    );
}
