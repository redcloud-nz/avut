/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";

import { eq, useLiveQuery } from "@tanstack/react-db";

import {
    DropdownMenuTriggerIcon,
    ObjectIcons,
    ReorderIcon,
} from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuGroupLabel,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { ReorderGroupsDialog } from "./reorder-groups";

interface SkillPackageBuilder_Package_Groups_ListProps {
    skillPackage: SkillPackage;
}

/**
 * Component to display a list of the groups, and skills within those groups, for a given skill package.
 * Provides buttons to create new skills and groups within the package.
 * @param skillPackageId The ID of the skill package whose groups are being displayed.
 * @returns A React component displaying the skill groups in a table format, or an alert if no groups are present.
 */
export function SkillPackageBuilder_Package_Contents_List({
    skillPackage,
}: SkillPackageBuilder_Package_Groups_ListProps) {
    const organization = useOrganization();

    const groupsQuery = useLiveQuery((q) =>
        q
            .from({ skillGroup: getSkillGroupsCollection(organization.id) })
            .where(({ skillGroup }) =>
                eq(skillGroup.skillPackageId, skillPackage.id),
            )
            .orderBy(({ skillGroup }) => skillGroup.sequence),
    );

    const skillsQuery = useLiveQuery((q) => {
        return q
            .from({ skill: getSkillsCollection(organization.id) })
            .where(({ skill }) => eq(skill.skillPackageId, skillPackage.id))
            .orderBy(({ skill }) => skill.sequence);
    });

    const [statusFilter, setStatusFilter] = useState(["Active"]);
    const [reorderDialogOpen, setReorderDialogOpen] = useState(false);

    const packagePath = Paths.org(
        organization.slug,
    ).skillPackageBuilder.skillPackage(skillPackage.id);

    const groups = groupsQuery.data ?? [];
    const skills = skillsQuery.data ?? [];

    const filteredGroups = groups.filter((group) =>
        statusFilter.includes(group.status),
    );
    const filteredSkills = skills.filter((skill) =>
        statusFilter.includes(skill.status),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>{skillPackage.name}</CardTitle>
                <CardDescription>Skill Package Contents</CardDescription>
                <CardAction>
                    <Protect
                        orgId={organization.id}
                        permissions={{ skillPackage: ["update"] }}
                    >
                        <ButtonGroup>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <ObjectIcons.Create />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-40"
                                >
                                    <DropdownMenuGroup>
                                        <DropdownMenuItem asChild>
                                            <Link
                                                to={packagePath.groups.create}
                                            >
                                                <ObjectIcons.Create /> New Group
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link
                                                to={packagePath.skills.create()}
                                            >
                                                <ObjectIcons.Create /> New Skill
                                            </Link>
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <DropdownMenuTriggerIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-40"
                                >
                                    <DropdownMenuGroup>
                                        <DropdownMenuItem
                                            onClick={() =>
                                                setReorderDialogOpen(true)
                                            }
                                        >
                                            <ReorderIcon /> Reorder Groups
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuGroup>
                                        <DropdownMenuGroupLabel>
                                            Show
                                        </DropdownMenuGroupLabel>
                                        {["Active", "Archived"].map(
                                            (status) => (
                                                <DropdownMenuCheckboxItem
                                                    key={status}
                                                    checked={statusFilter.includes(
                                                        status,
                                                    )}
                                                    onCheckedChange={(
                                                        checked,
                                                    ) => {
                                                        if (checked) {
                                                            setStatusFilter(
                                                                (prev) => [
                                                                    ...prev,
                                                                    status,
                                                                ],
                                                            );
                                                        } else {
                                                            setStatusFilter(
                                                                (prev) =>
                                                                    prev.filter(
                                                                        (s) =>
                                                                            s !==
                                                                            status,
                                                                    ),
                                                            );
                                                        }
                                                    }}
                                                >
                                                    {status}
                                                </DropdownMenuCheckboxItem>
                                            ),
                                        )}
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </ButtonGroup>
                    </Protect>
                </CardAction>
            </CardHeader>
            <CardContent>
                <Show
                    when={groupsQuery.isReady && skillsQuery.isReady}
                    fallback={
                        <Skeleton className="w-full h-13 mb-4">
                            Loading Skills
                        </Skeleton>
                    }
                >
                    {filteredGroups.length > 0 || filteredSkills.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeadCell>Group</TableHeadCell>
                                    <TableHeadCell>Skill</TableHeadCell>
                                    <TableHeadCell>Status</TableHeadCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredGroups.map((skillGroup) => {
                                    const groupSkills = filteredSkills.filter(
                                        (skill) =>
                                            skill.skillGroupId ===
                                            skillGroup.id,
                                    );

                                    return (
                                        <>
                                            <TableRow key={skillGroup.id}>
                                                <TableCell
                                                    rowSpan={
                                                        groupSkills.length + 1
                                                    }
                                                >
                                                    <Link
                                                        to={packagePath.group(
                                                            skillGroup.id,
                                                        )}
                                                    >
                                                        {skillGroup.name}
                                                    </Link>
                                                </TableCell>
                                                {groupSkills.length === 0 && (
                                                    <>
                                                        <TableCell>
                                                            <em className="text-muted-foreground">
                                                                No skills in
                                                                this group
                                                            </em>
                                                        </TableCell>
                                                        <TableCell>
                                                            {skillGroup.status}
                                                        </TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                            {groupSkills.map((skill) => (
                                                // Skills that belong to a group will be listed under their respective group
                                                <TableRow key={skill.id}>
                                                    <TableCell>
                                                        <Link
                                                            to={Paths.org(
                                                                organization.slug,
                                                            )
                                                                .skillPackageBuilder.skillPackage(
                                                                    skillGroup.skillPackageId,
                                                                )
                                                                .skill(
                                                                    skill.id,
                                                                )}
                                                        >
                                                            {skill.name}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>
                                                        {skillGroup.status ==
                                                        "Active"
                                                            ? skill.status
                                                            : skillGroup.status}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    ) : (
                        <Alert
                            severity="info"
                            title={
                                groups.length == 0 && skills.length == 0
                                    ? "No groups or skills defined for this package yet."
                                    : "No groups or skills match the current filter settings."
                            }
                        />
                    )}
                </Show>
            </CardContent>
            <ReorderGroupsDialog
                skillPackage={skillPackage}
                open={reorderDialogOpen}
                onOpenChange={setReorderDialogOpen}
            />
        </Card>
    );
}
