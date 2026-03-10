/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/skill-package-builder/packages/[package_id]
 */
"use client";

import { Fragment, use } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";
import { Alert } from "@/components/ui/alert";
import { Link } from "@/components/ui/link";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export default function SkillPackageBuilder_PackageContents_Page(
    props: PageProps<`/main/[slug]/skill-package-builder/packages/[package_id]/contents`>,
) {
    const { slug, package_id } = use(props.params);
    const organization = useOrganization();

    const [{ data: skillPackages }, { data: groups }, { data: skills }] =
        useSuspenseQueries({
            queries: [
                trpc.skillPackageBuilder.listPackages.queryOptions({
                    organizationId: organization.id,
                }),
                trpc.skillPackageBuilder.listGroups.queryOptions({
                    organizationId: organization.id,
                    skillPackageId: package_id,
                }),
                trpc.skillPackageBuilder.listSkills.queryOptions({
                    organizationId: organization.id,
                    skillPackageId: package_id,
                }),
            ],
        });

    const skillPackage = skillPackages.find((pkg) => pkg.id === package_id);
    if (!skillPackage) throw new Error(`SkillPackage(${package_id}) not found`);

    const packagePath =
        Paths.main(slug).skillPackageBuilder.skillPackage(skillPackage);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).skillPackageBuilder.index,
                    packagePath.index,
                    "Contents",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="full">
                    {groups.length > 0 || skills.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeadCell>Group</TableHeadCell>
                                    <TableHeadCell>Skill</TableHeadCell>
                                    <TableHeadCell>Description</TableHeadCell>
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
                                                            to={Paths.main(
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
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
