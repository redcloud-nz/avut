/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Fragment } from "react";
import Link from "next/link";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_PackageContents_Content({
    skillPackageId,
}: {
    skillPackageId: SkillPackageId;
}) {
    const organization = useOrganization();

    const [{ data: skillPackage }, { data: groups }, { data: skills }] = useSuspenseQueries({
        queries: [
            trpc.skillPackageBuilder.getPackage.queryOptions({
                organizationId: organization.id,
                skillPackageId,
            }),
            trpc.skillPackageBuilder.listGroups.queryOptions({
                organizationId: organization.id,
                skillPackageId,
            }),
            trpc.skillPackageBuilder.listSkills.queryOptions({
                organizationId: organization.id,
                skillPackageId,
            }),
        ],
    });

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/orgs/[slug]/skill-package-builder", {
                            slug: organization.slug,
                        }),
                    },
                    {
                        label: skillPackage.name,
                        href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                            slug: organization.slug,
                            package_id: skillPackageId,
                        }),
                    },
                    "Contents",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Package Contents</Saratoga.Title>
                    </Saratoga.Header>
                    {groups.length > 0 || skills.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeadCell>Group</TableHeadCell>
                                    <TableHeadCell>Skill</TableHeadCell>
                                    <TableHeadCell>Description</TableHeadCell>
                                    <TableHeadCell className="text-center">Required</TableHeadCell>
                                    <TableHeadCell className="text-center">Frequency</TableHeadCell>
                                    <TableHeadCell className="text-center">Status</TableHeadCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groups.map((skillGroup) => {
                                    const groupSkills = skills.filter(
                                        (skill) => skill.skillGroupId === skillGroup.id,
                                    );

                                    return (
                                        <Fragment key={skillGroup.id}>
                                            <TableRow key={skillGroup.id}>
                                                <TableCell rowSpan={groupSkills.length + 1}>
                                                    <Link
                                                        href={route(
                                                            "/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]",
                                                            {
                                                                slug: organization.slug,
                                                                package_id: skillPackageId,
                                                                group_id: skillGroup.id,
                                                            },
                                                        )}
                                                    >
                                                        {skillGroup.name}
                                                    </Link>
                                                </TableCell>
                                                {groupSkills.length === 0 && (
                                                    <>
                                                        <TableCell>
                                                            <em className="text-muted-foreground">
                                                                No skills in this group
                                                            </em>
                                                        </TableCell>
                                                        <TableCell>{skillGroup.status}</TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                            {groupSkills.map((skill) => (
                                                // Skills that belong to a group will be listed under their respective group
                                                <TableRow key={skill.id}>
                                                    <TableCell>
                                                        <Link
                                                            href={route(
                                                                "/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]",
                                                                {
                                                                    slug: organization.slug,
                                                                    package_id:
                                                                        skillGroup.skillPackageId,
                                                                    skill_id: skill.id,
                                                                },
                                                            )}
                                                        >
                                                            {skill.name}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>{skill.description}</TableCell>
                                                    <TableCell className="text-center">
                                                        {skill.defaultRequired ? "Yes" : "No"}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {`${skill.frequency}`}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {skillGroup.status == "Active"
                                                            ? skill.status
                                                            : skillGroup.status}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    ) : (
                        <Alert>
                            <AlertTitle>
                                {groups.length == 0 && skills.length == 0
                                    ? "No groups or skills defined for this package yet."
                                    : "No groups or skills match the current filter settings."}
                            </AlertTitle>
                        </Alert>
                    )}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
