/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { count, eq, useLiveQuery } from "@tanstack/react-db";

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
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";

interface SkillPackageBuilder_Package_Groups_ListProps {
    skillPackageId: SkillPackageId;
}

/**
 * Component to display a list of skill groups within a skill package.
 * Provides a button to create new groups within the package.
 * @param skillPackageId The ID of the skill package whose groups are being displayed.
 * @returns A React component displaying the skill groups in a table format, or an alert if no groups are present.
 */
export function SkillPackageBuilder_Package_Groups_List({
    skillPackageId,
}: SkillPackageBuilder_Package_Groups_ListProps) {
    const organization = useOrganization();

    const { data: skillGroups, isReady } = useLiveQuery((q) => {
        const skillCounts = q
            .from({ skill: getSkillsCollection(organization.id) })
            .groupBy(({ skill }) => skill.skillGroupId)
            .select(({ skill }) => ({
                skillGroupId: skill.skillGroupId,
                skillCount: count(skill.id),
            }));

        return q
            .from({ skillGroup: getSkillGroupsCollection(organization.id) })
            .join({ skillCount: skillCounts }, ({ skillGroup, skillCount }) =>
                eq(skillGroup.id, skillCount.skillGroupId),
            )
            .where(({ skillGroup }) =>
                eq(skillGroup.skillPackageId, skillPackageId),
            )
            .select(({ skillGroup, skillCount }) => ({
                ...skillGroup,
                skillCount: skillCount?.skillCount,
            }));
    });

    const packagePath = Paths.org(
        organization.slug,
    ).skillPackageBuilder.skillPackage(skillPackageId);

    return (
        <Hermes.Section>
            <Hermes.SectionHeader>
                <Hermes.SectionTitle>Groups</Hermes.SectionTitle>
                <Button variant="outline" asChild>
                    <Link to={packagePath.groups.create}>
                        <ObjectIcons.Create /> Group
                    </Link>
                </Button>
            </Hermes.SectionHeader>

            <Show
                when={isReady}
                fallback={
                    <Skeleton className="w-full h-13 mb-4">
                        Loading Skills
                    </Skeleton>
                }
            >
                {skillGroups.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell>Name</TableHeadCell>
                                <TableHeadCell className="text-center">
                                    Skill Count
                                </TableHeadCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {skillGroups.map((skillGroup) => (
                                <TableRow key={skillGroup.id}>
                                    <TableCell>
                                        <Link
                                            to={packagePath.group(
                                                skillGroup.id,
                                            )}
                                        >
                                            {skillGroup.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {skillGroup.skillCount ?? 0}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <Alert
                        severity="info"
                        title="No groups have been created for this package yet."
                    />
                )}
            </Show>
        </Hermes.Section>
    );
}
