/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Fragment, useState } from "react";

import { useQueries } from "@tanstack/react-query";

import {
    FilterColumnValuesIcon,
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
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
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
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_ReorderGroups_Dialog } from "./reorder-groups";
import { SkillPackageBuilder_CreateGroup_Dialog } from "./groups/create-group";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";

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

    const [groupsQuery, skillsQuery] = useQueries({
        queries: [
            trpc.skills.listGroups.queryOptions({
                organizationId: organization.id,
                skillPackageId: skillPackage.id,
            }),
            trpc.skills.listSkills.queryOptions({
                organizationId: organization.id,
                skillPackageId: skillPackage.id,
            }),
        ],
    });

    const [statusFilter, setStatusFilter] = useState(["Active"]);
    const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
    const [reorderDialogOpen, setReorderDialogOpen] = useState(false);

    const packagePath = Paths.org(
        organization.slug,
    ).skillPackageBuilder.skillPackage(skillPackage.id);

    const groups = (groupsQuery.data ?? []).sort(
        (a, b) => a.sequence - b.sequence,
    );
    const skills = (skillsQuery.data ?? []).sort(
        (a, b) => a.sequence - b.sequence,
    );

    const filteredGroups = groups.filter((group) =>
        statusFilter.includes(group.status),
    );
    const filteredSkills = skills.filter((skill) =>
        statusFilter.includes(skill.status),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Package Contents</CardTitle>
                <CardAction>
                    <Protect
                        orgId={organization.id}
                        permissions={{ skillPackage: ["update"] }}
                    >
                        <ButtonGroup>
                            <Button
                                variant="ghost"
                                size="icon"
                                tooltip="Add Group"
                                onClick={() => setCreateGroupDialogOpen(true)}
                            >
                                <ObjectIcons.Create />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                tooltip="Reorder Groups"
                                onClick={() => setReorderDialogOpen(true)}
                            >
                                <ReorderIcon />
                            </Button>
                        </ButtonGroup>
                    </Protect>
                </CardAction>
            </CardHeader>
            <CardContent>
                <Show
                    when={groupsQuery.isSuccess && skillsQuery.isSuccess}
                    fallback={
                        <Skeleton className="w-full h-13 mb-4">
                            Loading Skills
                        </Skeleton>
                    }
                >
                    <Show
                        when={
                            filteredGroups.length > 0 ||
                            filteredSkills.length > 0
                        }
                        fallback={
                            <Empty>
                                <EmptyHeader>
                                    <EmptyTitle>No skill yet</EmptyTitle>
                                    <EmptyDescription>
                                        You have not created any groups or skill
                                        in this package yet. Click the
                                        <ObjectIcons.Create className="inline-block mx-1 size-4" />
                                        button to add a group.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        }
                    >
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeadCell>Group</TableHeadCell>
                                    <TableHeadCell>Skill</TableHeadCell>
                                    <TableHeadCell className="w-25">
                                        Status{" "}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="text-muted-foreground"
                                                >
                                                    <FilterColumnValuesIcon />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-50">
                                                <DropdownMenuLabel>
                                                    Filter
                                                </DropdownMenuLabel>
                                                <DropdownMenuSeparator />

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
                                                                        (
                                                                            prev,
                                                                        ) => [
                                                                            ...prev,
                                                                            status,
                                                                        ],
                                                                    );
                                                                } else {
                                                                    setStatusFilter(
                                                                        (
                                                                            prev,
                                                                        ) =>
                                                                            prev.filter(
                                                                                (
                                                                                    s,
                                                                                ) =>
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
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableHeadCell>
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
                                        <Fragment key={skillGroup.id}>
                                            <TableRow key={skillGroup.id}>
                                                <TableCell
                                                    // rowSpan={
                                                    //     groupSkills.length + 1
                                                    // }
                                                    colSpan={2}
                                                >
                                                    <Link
                                                        to={packagePath.group(
                                                            skillGroup.id,
                                                        )}
                                                    >
                                                        {skillGroup.name}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    {skillGroup.status}
                                                </TableCell>
                                            </TableRow>
                                            {groupSkills.map((skill) => (
                                                // Skills that belong to a group will be listed under their respective group
                                                <TableRow key={skill.id}>
                                                    <TableCell></TableCell>
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
                                                        {skill.status}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Show>
                </Show>
            </CardContent>
            <SkillPackageBuilder_CreateGroup_Dialog
                skillPackage={skillPackage}
                open={createGroupDialogOpen}
                onOpenChange={setCreateGroupDialogOpen}
            />
            <SkillPackageBuilder_ReorderGroups_Dialog
                skillPackage={skillPackage}
                open={reorderDialogOpen}
                onOpenChange={setReorderDialogOpen}
            />
        </Card>
    );
}
