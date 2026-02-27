/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

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
import { SkillGroup } from "@/lib/schemas/skill-group";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { ReorderSkillsDialog } from "./reorder-skills";

interface SkillPackageBuilder_Group_Skills_ListProps {
    skillGroup: SkillGroup;
}

/**
 * Component to display a list of skills within a skill group.
 * Provides a button to create new skills within the group.
 * @param skillGroupId The ID of the skill group whose skills are being displayed.
 * @returns A React component displaying the skills in a table format, or an alert if no skills are present.
 */
export function SkillPackageBuilder_Group_Skills_List({
    skillGroup,
}: SkillPackageBuilder_Group_Skills_ListProps) {
    const organization = useOrganization();

    const skillsQuery = useQuery(
        trpc.skills.listSkills.queryOptions({
            organizationId: organization.id,
            skillPackageId: skillGroup.skillPackageId,
            skillGroupId: skillGroup.id,
        }),
    );

    const [statusFilter, setStatusFilter] = useState(["Active"]);
    const [reorderDialogOpen, setReorderDialogOpen] = useState(false);

    const packagePath = Paths.org(
        organization.slug,
    ).skillPackageBuilder.skillPackage(skillGroup.skillPackageId);

    const skills = (skillsQuery.data ?? []).sort(
        (a, b) => a.sequence - b.sequence,
    );
    const filteredSkills =
        skills.filter((skill) => statusFilter.includes(skill.status)) ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>{skillGroup.name}</CardTitle>
                <CardDescription>Skill Group Contents</CardDescription>
                <CardAction>
                    <Protect
                        orgId={organization.id}
                        permissions={{ skillPackage: ["update"] }}
                    >
                        <ButtonGroup>
                            <Button variant="ghost" asChild>
                                <Link
                                    to={
                                        packagePath.group(skillGroup.id).skills
                                            .create
                                    }
                                >
                                    <ObjectIcons.Create />
                                </Link>
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <DropdownMenuTriggerIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="w-50"
                                >
                                    <DropdownMenuGroup>
                                        <DropdownMenuItem
                                            onClick={() =>
                                                setReorderDialogOpen(true)
                                            }
                                        >
                                            <ReorderIcon /> Reorder Skills
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
                    when={skillsQuery.isSuccess}
                    fallback={<Skeleton className="w-full h-13 mb-4" />}
                >
                    {filteredSkills.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeadCell>Name</TableHeadCell>
                                    <TableHeadCell>Status</TableHeadCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSkills.map((skill) => (
                                    <TableRow key={skill.id}>
                                        <TableCell>
                                            <Link
                                                to={Paths.org(organization.slug)
                                                    .skillPackageBuilder.skillPackage(
                                                        skillGroup.skillPackageId,
                                                    )
                                                    .group(skillGroup.id)
                                                    .skill(skill.id)}
                                            >
                                                {skill.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{skill.status}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Alert
                            severity="info"
                            title={
                                skills.length == 0
                                    ? "No skills defined for this group yet."
                                    : "No skills match the current filter settings."
                            }
                        />
                    )}
                </Show>
            </CardContent>
            <ReorderSkillsDialog
                skillGroup={skillGroup}
                open={reorderDialogOpen}
                onOpenChange={setReorderDialogOpen}
            />
        </Card>
    );
}
