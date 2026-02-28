/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

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
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
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
        trpc.skills.listSkills.queryOptions({
            organizationId: organization.id,
            skillPackageId: skillPackage.id,
        }),
    );

    const [statusFilter, setStatusFilter] = useState(["Active"]);
    const [createSkillDialogOpen, setCreateSkillDialogOpen] = useState(false);
    const [reorderDialogOpen, setReorderDialogOpen] = useState(false);

    const skills = (skillsQuery.data ?? []).sort(
        (a, b) => a.sequence - b.sequence,
    );
    const filteredSkills =
        skills.filter((skill) => statusFilter.includes(skill.status)) ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Skill Group Contents</CardTitle>
                <CardAction>
                    <Protect
                        orgId={organization.id}
                        permissions={{ skillPackage: ["update"] }}
                    >
                        <ButtonGroup>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setCreateSkillDialogOpen(true)}
                                tooltip="New Skill"
                            >
                                <ObjectIcons.Create />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setReorderDialogOpen(true)}
                                tooltip="Reorder Skills"
                            >
                                <ReorderIcon />
                            </Button>
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
                                    <TableHeadCell>
                                        Status
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="text-muted-foreground ml-1"
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
                                {filteredSkills.map((skill) => (
                                    <TableRow key={skill.id}>
                                        <TableCell>
                                            <Link
                                                to={Paths.org(organization.slug)
                                                    .skillPackageBuilder.skillPackage(
                                                        skillGroup.skillPackageId,
                                                    )
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
            <SkillPackageBuilder_CreateSkill_Dialog
                skillGroup={skillGroup}
                skillPackage={skillPackage}
                open={createSkillDialogOpen}
                onOpenChange={setCreateSkillDialogOpen}
            />
            <SkillPackageBuilder_ReorderSkills_Dialog
                skillGroup={skillGroup}
                open={reorderDialogOpen}
                onOpenChange={setReorderDialogOpen}
            />
        </Card>
    );
}
