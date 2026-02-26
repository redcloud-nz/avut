/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]
 */
"use client";

import { Fragment, use } from "react";

import { eq, useLiveQuery, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Lexington } from "@/components/blocks/lexington";
import { Show } from "@/components/show";
import { Alert } from "@/components/ui/alert";
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
import * as Paths from "@/paths";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";

export default function SkillPackageBuilder_PackageContents_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/contents`>,
) {
    const { slug, package_id } = use(props.params);
    const organization = useOrganization();

    const { data: skillPackage } = useLiveSuspenseQuery((q) =>
        q
            .from({ skillPackage: getSkillPackagesCollection(organization.id) })
            .where(({ skillPackage }) => eq(skillPackage.id, package_id))
            .findOne(),
    );

    if (!skillPackage)
        throw new Error(`Skill Package (${package_id}) not found`);

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

    const packagePath =
        Paths.org(slug).skillPackageBuilder.skillPackage(skillPackage);

    const groups = groupsQuery.data ?? [];
    const skills = skillsQuery.data ?? [];

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    packagePath.index,
                    "Contents",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="full">
                    <Show
                        when={groupsQuery.isReady && skillsQuery.isReady}
                        fallback={
                            <Skeleton className="w-full h-13 mb-4">
                                Loading Skills
                            </Skeleton>
                        }
                    >
                        {groups.length > 0 || skills.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeadCell>Group</TableHeadCell>
                                        <TableHeadCell>Skill</TableHeadCell>
                                        <TableHeadCell>
                                            Description
                                        </TableHeadCell>
                                        <TableHeadCell className="text-center">
                                            Required
                                        </TableHeadCell>
                                        <TableHeadCell className="text-center">
                                            Frequency
                                        </TableHeadCell>
                                        <TableHeadCell className="text-center">
                                            Status
                                        </TableHeadCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groups.map((skillGroup) => {
                                        const groupSkills = skills.filter(
                                            (skill) =>
                                                skill.skillGroupId ===
                                                skillGroup.id,
                                        );

                                        return (
                                            <Fragment key={skillGroup.id}>
                                                <TableRow key={skillGroup.id}>
                                                    <TableCell
                                                        rowSpan={
                                                            groupSkills.length +
                                                            1
                                                        }
                                                    >
                                                        <Link
                                                            to={
                                                                packagePath.group(
                                                                    skillGroup.id,
                                                                ).index
                                                            }
                                                        >
                                                            {skillGroup.name}
                                                        </Link>
                                                    </TableCell>
                                                    {groupSkills.length ===
                                                        0 && (
                                                        <>
                                                            <TableCell>
                                                                <em className="text-muted-foreground">
                                                                    No skills in
                                                                    this group
                                                                </em>
                                                            </TableCell>
                                                            <TableCell>
                                                                {
                                                                    skillGroup.status
                                                                }
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
                                                                    .group(
                                                                        skillGroup.id,
                                                                    )
                                                                    .skill(
                                                                        skill.id,
                                                                    )}
                                                            >
                                                                {skill.name}
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell>
                                                            {skill.description}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {skill.defaultRequired
                                                                ? "Yes"
                                                                : "No"}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {`${skill.frequency}`}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {skillGroup.status ==
                                                            "Active"
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
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
