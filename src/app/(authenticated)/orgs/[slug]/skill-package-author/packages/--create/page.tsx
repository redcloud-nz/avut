/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-author/packages/--create
 */

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";

import { SkillPackageAuthor_PackageCreate_Form } from "./create-package";

export const metadata = {
    title: `Create Skill Package`,
};

export default async function SkillPackageAuthor_PackageCreate_Page(
    props: PageProps<`/orgs/[slug]/skill-package-author/packages/--create`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageAuthor.index,
                    Paths.org(slug).skillPackageAuthor.skillPackages,
                    Paths.org(slug).skillPackageAuthor.skillPackages.create,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={
                                    Paths.org(slug).skillPackageAuthor
                                        .skillPackages
                                }
                            >
                                Skill Packages
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>New Skill Package</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <SkillPackageAuthor_PackageCreate_Form
                                    organization={organization}
                                />
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
