/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-author/packages/[package_id]/--update
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";
import { SkillPackageAuthor_UpdatePackage_Form } from "./update-package";

export default function SkillPackageAuthor_PackageUpdate_Page(
    props: PageProps<`/orgs/[slug]/skill-package-author/packages/[package_id]/--update`>,
) {
    const { slug, package_id } = use(props.params);
    const organization = useOrganization();

    const { data: skillPackage } = useSuspenseQuery(
        trpc.skills.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId: package_id,
        }),
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageAuthor.index,
                    Paths.org(slug).skillPackageAuthor.skillPackages,
                    skillPackage.name,
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={Paths.org(
                                    slug,
                                ).skillPackageAuthor.skillPackage(package_id)}
                            >
                                {skillPackage.name}
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>Update Skill Package</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <SkillPackageAuthor_UpdatePackage_Form
                                    organization={organization}
                                    skillPackage={skillPackage}
                                />
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
