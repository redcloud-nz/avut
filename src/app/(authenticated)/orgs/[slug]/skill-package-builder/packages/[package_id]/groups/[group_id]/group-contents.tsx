/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";
import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { FilterColumnValuesIcon, ObjectIcons, ReorderIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
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
import { SkillPackage } from "@/lib/schemas/skill-package";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_CreateSkill_Dialog } from "../../skills/create-skill";
import { SkillPackageBuilder_ReorderSkills_Dialog } from "./reorder-skills";

/**
 * Component to display a list of skills within a skill group.
 * Provides a button to create new skills within the group.
 * @param skillGroup The skill group whose skills are being displayed.
 * @param skillPackage The skill package to which the skill group belongs.
 * @returns A React component displaying the skills in a table format, or an alert if no skills are present.
 */
export function SkillPackageBuilder_Group_Contents_List({
    skillGroup,
    skillPackage,
}: {
    skillGroup: SkillGroup;
    skillPackage: SkillPackage;
}) {
    const organization = useOrganization();

    const skillsQuery = useQuery(
        trpc.skillPackageBuilder.listSkills.queryOptions({
            organizationId: organization.id,
            skillPackageId: skillPackage.id,
        }),
    );

    const [createSkillDialogOpen, setCreateSkillDialogOpen] = useState(false);
    const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    const skills = (skillsQuery.data ?? [])
        .filter((s) => s.skillGroupId === skillGroup.id)
        .sort((a, b) => a.sequence - b.sequence);
    const filteredSkills = skills.filter((skill) => showArchived || skill.status !== "Archived");

    return (
        <Card>
            <CardHeader>
                <CardTitle>Skill Group Contents</CardTitle>
                <CardAction>
                    <Protect
                        orgId={organization.id}
                        permissions={{ skillPackageBuilder: ["update"] }}
                    >
                        <ButtonGroup>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setCreateSkillDialogOpen(true)}
                            >
                                <ObjectIcons.Create />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setReorderDialogOpen(true)}
                            >
                                <ReorderIcon />
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <FilterColumnValuesIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-50" align="end">
                                    <DropdownMenuLabel>Show</DropdownMenuLabel>
                                    <DropdownMenuCheckboxItem
                                        checked={showArchived}
                                        onCheckedChange={(checked) => setShowArchived(checked)}
                                    >
                                        Archived
                                    </DropdownMenuCheckboxItem>
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
                    <Show
                        when={filteredSkills.length > 0}
                        fallback={
                            <Empty>
                                <EmptyHeader>
                                    <EmptyTitle>No skill yet</EmptyTitle>
                                    <EmptyDescription>
                                        You have not created any skill in this group yet. Click the{" "}
                                        <ObjectIcons.Create className="inline-block mr-1 size-4" />{" "}
                                        button to add a skill.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        }
                    >
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeadCell>Name</TableHeadCell>
                                    <TableHeadCell className="text-center">Required</TableHeadCell>
                                    <TableHeadCell>Status</TableHeadCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSkills.map((skill) => (
                                    <TableRow key={skill.id}>
                                        <TableCell>
                                            <Link
                                                href={route(
                                                    "/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]",
                                                    {
                                                        slug: organization.slug,
                                                        package_id: skillGroup.skillPackageId,
                                                        skill_id: skill.id,
                                                    },
                                                )}
                                            >
                                                {skill.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {skill.defaultRequired ? "Yes" : "No"}
                                        </TableCell>
                                        <TableCell>{skill.status}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Show>
                </Show>
            </CardContent>
            <SkillPackageBuilder_CreateSkill_Dialog
                skillGroup={skillGroup}
                skillPackage={skillPackage}
                open={createSkillDialogOpen}
                onOpenChange={setCreateSkillDialogOpen}
            />
            <SkillPackageBuilder_ReorderSkills_Dialog
                skillGroup={skillGroup}
                skillPackage={skillPackage}
                open={reorderDialogOpen}
                onOpenChange={setReorderDialogOpen}
            />
        </Card>
    );
}
